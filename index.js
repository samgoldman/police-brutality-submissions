const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 80;
const randomstring = require('randomstring');
const bodyParser = require('body-parser');
const git = require('simple-git/promise');
const rimraf = require('rimraf');
const { Octokit } = require('@octokit/rest');

if (fs.existsSync('police-brutality'))
	rimraf.sync("police-brutality");

const USER = process.env.GITHUB_USER;
const PASS = process.env.GITHUB_PASSWORD;
const REPO = `github.com/${USER}/police-brutality.git`;
const GITHUB_API_TOKEN = '${GITHUB_API_TOKEN}';

const octokit = new Octokit({
	auth: GITHUB_API_TOKEN
});

const remote = `https://${USER}:${PASS}@${REPO}`;
let git_repo = null;

// Initialize the local repository
git().silent(true)
	.clone(remote)
	.then(async () => {
		await git('./police-brutality').addRemote('upstream', 'https://github.com/2020PB/police-brutality.git');
		git_repo = await git('./police-brutality');
		await git_repo.addConfig('user.name', 'Samuel Goldman');
		await git_repo.addConfig('user.email', 'sgoldman216@gmail.com');
	})
	.catch((err) => console.error('Failed clone: ', err));

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

	let link_contents = '';

	links.forEach(link => {
		link_contents += `* ${link}\n`;
	});

	await git_repo.fetch('upstream', 'master');
	await git_repo.checkoutBranch(`patch-${branch_id}`, 'FETCH_HEAD');

	const filename = `./police-brutality/reports/${state}.md`;
	let contents;

	// Update the file
	if (fs.existsSync(filename)) {
		contents = fs.readFileSync(filename, 'utf-8');

		if (contents.indexOf(city) !== -1) {
			const index = contents.indexOf('\r\n', contents.indexOf(city)) + 2;

			contents = contents.substr(0, index)
				+ `\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}`
				+ contents.substr(index);
		} else {
			contents += `\r\n\r\n## ${city}\r\n\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}\r\n\r\n`;
		}
	} else {
		contents = `#${state}\r\n\r\n\r\n## ${city}\r\n\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}\r\n\r\n`;
	}

	fs.writeFileSync(filename, contents);

	// Add the changes, commit them, and push them
	await git_repo.add(`reports/${state}.md`);
	await git_repo.commit(`Update ${state}.md via web form`, );
	await git_repo.push(['--set-upstream', 'origin', `patch-${branch_id}`]);

	res.status(200).send(branch_id);
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
