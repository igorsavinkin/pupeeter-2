// https://github.com/GoogleChrome/puppeteer/issues/829#issuecomment-410703192
const puppeteer = require('puppeteer');
require('./login-xing.js');

puppeteer.launch({headless: false, sloMo: 200 }).then(browser => {
  browser.newPage()
    .then(page => {
      page.goto('https://www.xing.com')
        //.then(resp => page.screenshot({path: 'example.png'}))
        //.then(buffer => browser.close());
	    .then( () => set_cookie(page))
		.then( () => page.reload() );
    });
});