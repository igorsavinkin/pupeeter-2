// solution https://stackoverflow.com/a/50078167/1230477
// const config = require('./config.js');
// console.log('CREDS: ', config.CREDS);
const puppeteer = require('puppeteer');
const path = require('path');

function login_by_cookie_sync(browser, close=0, url='https://www.xing.com'){
	browser.newPage()
    .then(page => {
      page.goto(url)
	    .then( () => set_cookie(page))
		.then( () => page.reload() )
		.then( () => { if (close) { browser.close(); } });
    });	
}
function print_cookie(cookies, amount_only=false){	
	if (!amount_only){
		for (let i=0; i < cookies.length; i++){
			console.log(i+1, cookies[i].name, cookies[i].value);
		}
	}
	console.log('  Cookie items:',cookies.length);
}

async function check_if_logged_in(page, page_content = false){
	//console.log('  Checking if logged-in.');
	let user = await page.$('span.myxing-profile-name'); 
	let user_name = false;
	if (user){
		user_name = await (await user.getProperty('textContent')).jsonValue();
		//console.log('Logged in user:', user_name);
		//return true;
		return user_name;
	}
	if (!page_content) { 
		var page_content = await page.content();	 
	}
	if (page_content.includes('class="Me-Me')){ 
		return true;  
	} 
	return false;
}
async function login_page(page, username="", password="", cookieFile="") {
	if (!username) {
		const config = require('./config.js');
		username = config.CREDS.username;
		if (!password) { 
			password = config.CREDS.password;
		} 
	}   
	try {      // regular login
		await page.goto('https://www.xing.com/signup?login=1', { waitUntil: 'networkidle0' }); // wait until page load
		await page.type('input[name="login_form[username]"]', username);
		await page.type('input[name="login_form[password]"]', password);
		await page.evaluate(() => {
				document.getElementsByTagName('button')[1].click();
			});
	} catch(e){ //trying to relogin		
		await page.click('input[name="username"]', {clickCount: 3});
		await page.type('input[name="username"]',  username);
		await page.type('input[name="password"]',  password);
		await page.click('button[type="submit"]'); 
	} 
	await page.waitForNavigation({ waitUntil: 'networkidle0' });	 
	console.log('After (re)login_page():\n Page url :', await page.url())
	//let page_url = ; 
	//let page_content = await page.content();
	//console.log('  Page content size :', page_content.length );
	var login_check = await check_if_logged_in(page);
	console.log('  Login result:', login_check );
	if (login_check && cookieFile){ // save session cookies		
		const cookiesObject = await page.cookies();
		const jsonfile = require('jsonfile');
		/*if (!cookieFile){
			const config = require('./config.js');
			config.cookieFile = config.cookieFile;
		}*/
		cookiesFilePath = __dirname.split('/').pop() + path.sep +  cookieFile; 
		//console.log('cookiesFilePath:', cookiesFilePath);
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
	return login_check;
}

async function login(username="", password="", cookieFile="cookies.json", close_browser=1, slow_down_ms=50) {
	if (!username) {
		const config = require('./config.js');
		username = config.CREDS.username;
		if (!password) { 
			password = config.CREDS.password;
		} 
	}	
	const browser = await puppeteer.launch({
		headless: false,       // make it with screen
		slowMo: slow_down_ms   // slow down by ms.
		});
	const page = await browser.newPage();
	await page.setViewport({width: 800, height: 700});
	await page.goto('https://www.xing.com/signup?login=1', { waitUntil: 'networkidle0' }); // wait until page load
	await page.type('input[name="login_form[username]"]',  username);
	await page.type('input[name="login_form[password]"]',  password);
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
	cookiesFilePath = __dirname.split('/').pop() + path.sep + cookieFile; 
	//console.log('cookiesFilePath:', cookiesFilePath);
	
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
	cookiesFilePath = __dirname.split('/').pop() + path.sep + 'cookies.json'; // config.cookieFile; 
	//console.log('cookiesFilePath:', cookiesFilePath);
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
		//console.log(' * Session has been loaded in the browser. *');
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
global.check_if_logged_in = check_if_logged_in;
global.print_cookie=print_cookie;