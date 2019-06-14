const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');

var login_flag = false;
 
function printRequestQueue (requestQueue){
	let { totalRequestCount, handledRequestCount, pendingRequestCount } = requestQueue.getInfo();	
	console.log('\nRequest Queue:\n   total:', totalRequestCount); 
	console.log('   handled:', handledRequestCount, '\n   pending:', pendingRequestCount);	
}
function findAll(regexPattern, sourceString) { 
	let _Set = new Set();
    let match
    // make sure the pattern has the global flag
    let regexPatternWithGlobal = RegExp(regexPattern,"g")
    while (match = regexPatternWithGlobal.exec(sourceString)) { 
		_Set.add(match[0])
    } 
    return _Set
} 
function addLinksToRequestQueue(links, requestQueue){
	for (elem of links) {
		let name = elem.split('/companies/')[1];
		if (!['search', 'icons', 'industries', 'img', 'scraping'].includes(name) 
			&& !name.startsWith("application-")
			&& !name.startsWith("statistics-")		
			&& !name.startsWith("draggable-")){
			requestQueue.addRequest({ url: elem });
			//console.log('added:', elem);
		} else {
			//console.log('NOT added - ', elem);
		}
	}
	return requestQueue;
}
Apify.main(async () => {  
	// init variables from INPUT json file - apify_storage/key_value_stores/default/INPUT.json
	const input = await Apify.getInput(); // https://sdk.apify.com/docs/api/apify#module_Apify.getInput
	var concurrency =  parseInt(input.concurrency);
	var account = input.account["0"];
	var syllables = ['BA','BE','BI','BO','BU','BY','CA','CE','CI','CO','CU','CY','DA','DE','DI','DO','DU','DY','FA','FE','FI','FO','FU','FY','GA','GE','GI','GO','GU','GY','HA','HE','HI','HO','HU','HY','JA','JE','JI','JO','JU','JY','KA','KE','KI','KO','KU','KY','LA','LE','LI','LO','LU','LY','MA','ME','MI', 'MO','MU','MY','NA','NE','NI','NO','NU','NY','PA','PE','PI','PO','PU','PY','QA','QE','QI','QO','QU','QY','RA','RE','RI','RO','RU','RY','SA','SE','SI','SO','SU','SY','TA','TE','TI','TO','TU','TY','VA','VE','VI','VO','VU','VY','WA','WE','WI','WO','WU','WY','XA','XE','XI','XO','XU','XY' ].reverse();
	//process.exit();
	var page_handle_max_wait_time = parseInt( input.page_handle_max_wait_time);
	var max_requests_per_crawl =  parseInt( input.max_requests_per_crawl); 
	/*var links_found = {};
	var links_found_short = {};
	const link_regex = /(https:\/\/www\.xing\.com\/companies\/[\w|-]+)/g;
	const short_link_regex = /\/companies\/[\w|-]+/g; 
	var page_content='';*/
	var total_companies = 0;
	var base_req = 'https://www.xing.com/search/companies?sc_o=companies_search_button&filter.location[]=2921044&filter.size[]=9&keywords='	

    const requestQueue = await Apify.openRequestQueue();  
	requestQueue.addRequest({ url: 'https://www.xing.com/signup?login=1'});
   
    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		maxRequestsPerCrawl: max_requests_per_crawl,
        maxConcurrency: concurrency,
		launchPuppeteerOptions: { slowMo: 135 } , 
		gotoFunction: async ({ request, page }) => { 			
			try { 
			    if (!login_flag) { // we login at the first request 
					login_flag = true;  
					//console.log('\n\n Request Queue:\n', requestQueue);
					await login_page(page, account.username, account.password, input.cookieFile);					
				} 	
				await page.goto(request.url, { timeout: 60000 });
			} catch (error){
				console.log('\nPage request error:', error);
			};  
		},
        handlePageFunction: async ({ request, page }) => {
			await page.waitFor(Math.ceil(Math.random() * page_handle_max_wait_time))		
            try {
				let result = await page.$('div.ResultsOverview-style-title-8d816f3f');
				let companies_num = await (await result.getProperty('textContent')).jsonValue();
				//console.log('\n comp number:', companies_num);
				let amount = parseInt(companies_num.replace(',', ''));				
				if (!amount && companies_num.includes('One company')) { amount=1; }
				if (amount){
					console.log('\nFound amount:', amount);
					total_companies += amount;				
				} else {
					console.log('Amount is empty.'); 
				}
			} catch(error){
				console.log(`\nNo companies number found for ${request.url}:\n` , error);
			} 
			console.log('Total companies found: ', total_companies, '\n ******************');
			/*page_content = await page.content();
			links_found  =  findAll(link_regex, page_content);
			links_found_short =  findAll(short_link_regex, page_content);  			
			
			for (elem of links_found_short) {
				links_found.add('https://www.xing.com'+elem);	 
			} 
			console.log('FOUND LINKS at "'+ request.url +'": (', links_found.size, ')\n', links_found );		
			*/
			if (syllables) { 
				let syl = syllables.pop()
				let url = base_req + syl;
				//console.log('url:', url.split('/search/')[1]);
				requestQueue.addRequest({ url: url});
				console.log('Added an url with keyword:', syl);
				console.log('Syllables left:', syllables.length);
			} else {
				console.log('\nFinal total companies: ', total_companies);
				process.exit();
			}			
			//addLinksToRequestQueue(links_found, requestQueue); 
			//printRequestQueue(requestQueue);
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
			//printRequestQueue(requestQueue);
        },
        
    });

    await crawler.run();

	console.log('Request queue:', requestQueue.getInfo());
	console.log('\nDeleting requestQueue');
	await requestQueue.delete();
	// await queue.addRequest(new Apify.Request({ url: 'http://example.com/foo/bar'}, { forefront: true });

	console.log('\n******** Results ********');
	console.log(' Final total companies: ', total_companies); 
});