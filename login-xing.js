// solution https://stackoverflow.com/a/50078167/1230477
const config = require('./config.js');;
//console.log('CREDS: ', config.CREDS);
const puppeteer = require('puppeteer');
const path = require('path');

function login_by_cookie_sync(browser, close=0, url='https://www.xing.com'){
	browser.newPage()
    .then(page => {
      page.goto(url)
        //.then(buffer => browser.close());
	    .then( () => set_cookie(page))
		.then( () => page.reload() )
		.then( () => { if (close) { browser.close(); } });
    });	
}

async function login_page(page) {
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
	// Save Session Cookies
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
}

async function login(close_browser=1) {
	const browser = await puppeteer.launch({
		headless: false, // make it with screen
		slowMo: 50        // slow down by ms.
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
		return 0;
	} else {
		return page;
	}
              	
}

const jsonfile = require('jsonfile');
const fs = require('fs');

function set_cookie(page) {
	cookiesFilePath = __dirname.split('/').pop() + path.sep + config.cookieFile; 
	console.log('cookiesFilePath:', cookiesFilePath);
	const previousSession = fs.existsSync(cookiesFilePath);
	if (previousSession) {
	  const content = fs.readFileSync(cookiesFilePath);
	  const cookiesArr = JSON.parse(content);
	  if (cookiesArr.length !== 0) {
		//console.log('cookiesArr.length:', cookiesArr.length);
		for (let cookie of cookiesArr) {
			try { 
				page.setCookie(cookie);
			} catch (error) {
				console.log("Faiure set cookie:", cookie);
				console.log("error:", error); 
			}			
		}
		console.log(' *** Session has been loaded in the browser. ***');
		return true;
	  } else {
		  console.log('CookiesArr file length is 0.');
		  return false;
	  }
	} else {
		console.log('Previous session has not been found.');
		return false;
	}
} 

global.set_cookie = set_cookie;
global.login = login;
global.login_page = login_page;
global.login_by_cookie_sync = login_by_cookie_sync;