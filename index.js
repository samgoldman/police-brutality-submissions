const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 80;
const randomstring = require('randomstring');
const bodyParser = require('body-parser');
const git = require('simple-git/promise');
const rimraf = require('rimraf');
const { Octokit } = require('@octokit/rest');

const USER = process.env.GITHUB_USER;
const PASS = process.env.GITHUB_PASSWORD;
const REPO = `github.com/${USER}/police-brutality.git`;
const GITHUB_API_TOKEN = '${GITHUB_API_TOKEN}';

const octokit = new Octokit({
	auth: GITHUB_API_TOKEN
});

const remote = `https://${USER}:${PASS}@${REPO}`;

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));

// Handle submission. Requires state, city, title, description, links, and date
app.post('/submit', async (req, res) => {
	const branch_id = randomstring.generate(7);
	const state = req.body['state'];
	const city = req.body['city'];
	const title = req.body['title'];
	const description = req.body['description'];
	const links = req.body['links'].split('\n');
	const date = req.body['date'];

	fs.mkdirSync(`patch-${branch_id}`);

	// Initialize the local repository
	await git(`patch-${branch_id}`).silent(true).clone(remote);

	await git(`./patch-${branch_id}/police-brutality`).addRemote('upstream', 'https://github.com/2020PB/police-brutality.git');

	const git_repo = await git(`./patch-${branch_id}/police-brutality`);
	await git_repo.addConfig('user.name', 'Samuel Goldman');
	await git_repo.addConfig('user.email', 'sgoldman216@gmail.com');

	let link_contents = '';

	links.forEach(link => {
		link_contents += `* ${link}\n`;
	});

	await git_repo.fetch('upstream', 'master');
	await git_repo.checkoutBranch(`patch-${branch_id}`, 'FETCH_HEAD');

	const filename = `./patch-${branch_id}/police-brutality/reports/${state}.md`;
	let contents;
	let addition;

	// Update the file
	if (fs.existsSync(filename)) {
		contents = fs.readFileSync(filename, 'utf-8');

		if (contents.indexOf(city) !== -1) {
			const index = contents.indexOf('\r\n', contents.indexOf(city)) + 2;
			addition = `\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}`;

			contents = contents.substr(0, index)
				+ addition
				+ contents.substr(index);
		} else {
			addition = `\r\n\r\n## ${city}\r\n\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}\r\n\r\n`;
			contents += addition;
		}
	} else {
		addition = `#${state}\r\n\r\n\r\n## ${city}\r\n\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}\r\n\r\n`;
		contents = addition;
	}

	fs.writeFileSync(filename, contents);

	// Add the changes, commit them, and push them
	await git_repo.add(`reports/${state}.md`);
	await git_repo.commit(`Update ${state}.md via web form`, );
	await git_repo.push(['--set-upstream', 'origin', `patch-${branch_id}`]);

	rimraf.sync(`./patch-${branch_id}`);

	res.redirect('/success.html');
});

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
