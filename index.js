const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 80;
const randomstring = require('randomstring');
const bodyParser = require('body-parser');
const git = require('simple-git/promise');
const rimraf = require('rimraf');
const { Octokit } = require('@octokit/rest');
const Recaptcha = require('express-recaptcha').RecaptchaV2;

const recaptcha = new Recaptcha('6LdK_wAVAAAAAI5S9jLKp368pTw20bby7cVgfgKc', process.env.RECAPTCHA_SECRET_KEY);

const USER = process.env.GITHUB_USER;
const PASS = process.env.GITHUB_PASSWORD;
const REPO = `github.com/${USER}/police-brutality.git`;
const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN;

const octokit = new Octokit({
	auth: GITHUB_API_TOKEN
});

const remote = `https://${USER}:${PASS}@${REPO}`;

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));

const STATE_NAME_TO_CODE = {
	'Arizona': 'AZ',
	'Alabama': 'AL',
	'Alaska':'AK',
	'Arkansas': 'AR',
	'California': 'CA',
	'Colorado': 'CO',
	'Connecticut': 'CT',
	'Delaware': 'DE',
	'Florida': 'FL',
	'Georgia': 'GA',
	'Hawaii': 'HI',
	'Idaho': 'ID',
	'Illinois': 'IL',
	'Indiana': 'IN',
	'Iowa': 'IA',
	'Kansas': 'KS',
	'Kentucky': 'KY',
	'Louisiana': 'LA',
	'Maine': 'ME',
	'Maryland': 'MD',
	'Massachusetts': 'MA',
	'Michigan': 'MI',
	'Minnesota': 'MN',
	'Mississippi': 'MS',
	'Missouri': 'MO',
	'Montana': 'MT',
	'Nebraska': 'NE',
	'Nevada': 'NV',
	'New Hampshire': 'NH',
	'New Jersey': 'NJ',
	'New Mexico': 'NM',
	'New York': 'NY',
	'North Carolina': 'NC',
	'North Dakota': 'ND',
	'Ohio': 'OH',
	'Oklahoma': 'OK',
	'Oregon': 'OR',
	'Pennsylvania': 'PA',
	'Rhode Island': 'RI',
	'South Carolina': 'SC',
	'South Dakota': 'SD',
	'Tennessee': 'TN',
	'Texas': 'TX',
	'Utah': 'UT',
	'Vermont': 'VT',
	'Virginia': 'VA',
	'Washington': 'WA',
	'West Virginia': 'WV',
	'Wisconsin': 'WI',
	'Wyoming': 'WY',
	'Washington DC': 'DC',
	'Unknown Location': 'TBD'};

const get_state_code = state_name => {
	if (state_name === 'Washington DC') return 'dc';
	else if (state_name === 'Unknown Location') return 'tbd';
	else return STATE_NAME_TO_CODE[state_name];
};

const get_incident_id = (index, state_code, city) => {
	return `${state_code}-${city !== '' ? city : state_code}-${index}`.toLowerCase();
}

// Handle submission. Requires state, city, title, description, links, and date
app.post('/submit', recaptcha.middleware.verify, async (req, res) => {
	if (!req.recaptcha.error) {
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
		await git_repo.addConfig('user.name', '2020PB-bot');
		await git_repo.addConfig('user.email', '2020PB-bot@samueltgoldman.com');

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
			let lines = fs.readFileSync(filename, 'utf-8').split('\n');

			let inTargetCity = state === 'Washington DC' || state === 'Unknown Location';
			let numIncidents = 0;

			let i;
			for (i = 0; i < lines.length; i++) {
				const line = lines[i];

				if (line.startsWith('## ')) { // This is a city
					if (inTargetCity) break; // This is the end of the entries for the target city
					else if (line.substr(3).startsWith(city)) inTargetCity = true;
				} else if (line.startsWith('### '))  { // This is an incident
					numIncidents ++;
				}
			}

			let new_lines = [];

			// Add new lines, working backwards
			lines.splice(i, 0, '\r');
			new_lines.splice(0, 0, '\r');
			lines.splice(i, 0, '\r');
			new_lines.splice(0, 0, '\r');

			links.forEach(link => {
				lines.splice(i, 0, `* ${link}\r`);
				new_lines.splice(0, 0, `* ${link}\r`);
			});

			lines.splice(i, 0, '\r');
			new_lines.splice(0, 0, '\r');

			lines.splice(i, 0, '**Links**\r');
			new_lines.splice(0, 0, '**Links**\r');

			lines.splice(i, 0, '\r');
			new_lines.splice(0, 0, '\r');

			lines.splice(i, 0, `${description}\r`);
			new_lines.splice(0, 0, `${description}\r`);

			lines.splice(i, 0, '\r');
			new_lines.splice(0, 0, '\r');

			lines.splice(i, 0, `### ${title} | ${date}\r`)
			new_lines.splice(0, 0, `### ${title} | ${date}\r`);

			if (!inTargetCity) {
				lines.splice(i, 0, '\r');
				new_lines.splice(0, 0, '\r');
				lines.splice(i, 0, `## ${city}\r`);
				new_lines.splice(0, 0, `## ${city}\r`);
			}

			lines.splice(i, 0, '\r');
			new_lines.splice(0, 0, '\r');

			addition = new_lines.join('\n');
			contents = lines.join('\n');
		} else {
			addition = `#${state}\r\n\r\n\r\n## ${city}\r\n\r\n### ${title} | ${date}\r\n\r\n${description}\r\n\r\n**Links**\r\n${link_contents}\r\n\r\n`;
			contents = addition;
		}

		fs.writeFileSync(filename, contents);

		// Add the changes, commit them, and push them
		await git_repo.add(`reports/${state}.md`);
		await git_repo.commit(`Update ${state}.md via web form`,);
		await git_repo.push(['--set-upstream', 'origin', `patch-${branch_id}`]);

		try {
			rimraf.sync(`./patch-${branch_id}`);
		} catch (error) {
			console.log('Could not delete the git directory...');
		}

		await octokit.issues.create({
			owner: process.env.DEBUG === 'true' ? '2020PB-bot' : '2020PB',
			repo: 'police-brutality',
			title: `Incident in ${city},${state}`,
			body: `This issue is autogenerated based on a submission to police-brutality-submissions.heroku.com.
Proposed changes are on: https://github.com/${USER}/police-brutality/tree/patch-${branch_id}
View the proposed diff here: https://github.com/2020PB/police-brutality/compare/master...${USER}:patch-${branch_id}
Proposed additions to \`${state}.md\` are as follows:
\`\`\`
${addition}
\`\`\`
`
		});

		res.redirect('/success.html');
	} else {
		res.status(400);
		res.send('400: You failed recaptcha validation');
	}
});

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
