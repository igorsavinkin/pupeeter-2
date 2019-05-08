// solution https://stackoverflow.com/a/50078167/1230477
const config = require('./config.js');;
console.log('CREDS: ', config.CREDS);
const puppeteer = require('puppeteer');
const path = require('path');

async function login( close_browser=1) {
	const browser = await puppeteer.launch({
		headless: false, // make it with screen
		slowMo: 100        // slow down by ms.
		});
	const page = await browser.newPage();
	await page.setViewport({width: 800, height: 700});
	await page.goto('https://www.xing.com/signup?login=1', { waitUntil: 'networkidle0' }); // wait until page load
	await page.type('input[name="login_form[username]"]', config.CREDS.username);
	await page.type('input[name="login_form[password]"]', config.CREDS.password);
	// click and wait for navigation
	await Promise.all([
		page.evaluate(() => {
			document.getElementsByTagName('button')[1].click();
		}),
		page.waitForNavigation({ waitUntil: 'networkidle0' }),
	]).catch(e => console.log('Click error:', e));
	// Save Session Cookies - https://stackoverflow.com/a/48998450/1230477
	// and https://stackoverflow.com/a/54227598/1230477
	const cookiesObject = await page.cookies();
	const jsonfile = require('jsonfile');
	cookiesFilePath = __dirname.split('/').pop() + path.sep + config.cookieFile; 
	console.log('cookiesFilePath:', cookiesFilePath);
	
	// Write cookies to config.cookieFile to be used in other profile sessions.
	jsonfile.writeFile(cookiesFilePath, cookiesObject, { spaces: 2 },
		function(err) { 
			if (err){
				console.log('Failure!\nThe json session file could not be written.', err);
			} else {
				console.log('Success!!!\nSession has been successfully saved.\nCookie file:', cookiesFilePath);
			}
		});
	if (close_browser) {
		await browser.close();
	}
              	
}	
global.login = login;