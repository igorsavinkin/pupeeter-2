const Apify = require('apify');
const puppeteer = require('puppeteer');
// let's login to xing
require('./login-xing.js');

/*puppeteer.launch({headless: false, sloMo: 500 }).then(browser => {
	login_by_cookie_sync(browser, 1); // 0 - do not close browser
});*/

//process.exit();

Apify.main(async () => { 
	await login(); // we do init login and save cookie	
	//var login_flag=false; 
    const requestQueue = await Apify.openRequestQueue();
    //requestQueue.addRequest({ url: 'https://www.xing.com/signup?login=1' });
    requestQueue.addRequest({ url: 'https://www.xing.com/companies' });
	//console.log('Request Queue:', requestQueue);
    const pseudoUrls = [new Apify.PseudoUrl('https://www.xing.com/companies/[.+]')];

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		launchPuppeteerOptions: { slowMo: 100 } , 
		gotoFunction: async ({ request, page }) => { 			
			try { 
			    console.log('\nrequestQueue length (pending):', requestQueue.pendingRequestCount);
				if (1) { // !login_flag
					//login_flag = true; 
					set_cookie(page);
					page.reload();					
				}  		
				await page.goto(request.url, { timeout: 60000 });
			} catch (error){
				console.log('\nSetting cookie error:', error);
			};  
		},
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
        maxRequestsPerCrawl: 8,
        maxConcurrency: 2,
    });

    await crawler.run();
	
	console.log('\nDeleting requestQueue');
	await requestQueue.delete();
});
/**/