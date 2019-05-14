const Apify = require('apify');
const puppeteer = require('puppeteer');
// let's login to xing
require('./login-xing.js');

/*Promise.all([
	page = login(0)	 
]).catch(e => console.log('Login error:', e));
*/

new Promise((resolve, reject) => {
    page = login(0).then(function (page) {
		console.log('Page object inside promise:');
		console.log(page);
		console.log('\n******************************\nSettingSetting cookie...');
		//set_cookie(page);
	},
  )}
);
//console.log('Page object after the promise:', page);
//console.log(page);
//page = loginSync(0);

/*const browser = puppeteer.launch({
		headless: false, // make it with screen
		slowMo: 100        // slow down by ms.
		});
	const page = browser.newPage();*/
//set_cookie(page);

//process.exit();
/*
Apify.main(async () => {
    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({ url: 'https://www.iana.org/' });
    const pseudoUrls = [new Apify.PseudoUrl('https://www.iana.org/[.*]')];

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue,
        handlePageFunction: async ({ request, page }) => {
            const title = await page.title();
            console.log(`Title of ${request.url}: ${title}`);
            await Apify.utils.enqueueLinks({ page, selector: 'a', pseudoUrls, requestQueue });
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
        maxRequestsPerCrawl: 100,
        maxConcurrency: 10,
    });

    await crawler.run();
});
*/