const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');

var login_flag = false;
var total_page_links = new Set();

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
	var alphabet = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
	//process.exit();
	var page_handle_max_wait_time = parseInt( input.page_handle_max_wait_time);
	var max_requests_per_crawl =  parseInt( input.max_requests_per_crawl); 
	var links_found = {};
	var links_found_short = {};
	const link_regex = /(https:\/\/www\.xing\.com\/companies\/[\w|-]+)/g;
	const short_link_regex = /\/companies\/[\w|-]+/g; 
	var page_content='';
	var total_companies = 0;
	var base_req = 'https://www.xing.com/search/companies?sc_o=companies_search_button&filter.location[]=2921044&filter.size[]=9&keywords='	

    const requestQueue = await Apify.openRequestQueue();  
	requestQueue.addRequest({ url: 'https://www.xing.com/signup?login=1'});
	// Open a named key-value store
    const links_store = await Apify.openKeyValueStore('links_store');
   
   
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
			console.log('***********************');
			await page.waitFor(Math.ceil(Math.random() * page_handle_max_wait_time))		
            if (!request.url.includes('&page=')){ // if this is an initial request
				try { // we gather the total companies number
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
				if (  total_companies > 10) { // we create sub-requests
					// add paging requests
					let i;
					let max_page = total_companies > 300 ? 30 : Math.ceil(total_companies / 10); 
					console.log(request.url);
					for (i = 2; i <= max_page ; i++) { 
						let url = request.url + '&page=' + i.toString()					
						requestQueue.addRequest({ url: url });					
						console.log(' - added a paging request: page='+ i.toString());
					}				
				}
			}
			
			// adding companies' pages links 
			page_content = await page.content();
			links_found  =  findAll(link_regex, page_content);
			links_found_short  =  findAll(short_link_regex, page_content);  			
			
			for (elem of links_found_short) {
				links_found.add('https://www.xing.com'+elem);	 
			} 
			for (elem of links_found) {
				// save link into the links_store
				total_page_links.add(elem);  
			} 
			await links_store.setValue('scraped_urls', links_found );
			console.log('FOUND LINKS at "'+ request.url +'": (', links_found.size, ')\n', links_found );		
			console.log('TOTAL LINKS GATHERED:',   total_page_links.size  );		
			//addLinksToRequestQueue(links_found, requestQueue);
			
			/*if (syllables) { 
				let syl = syllables.pop()
				let url = base_req + syl;
				//console.log('url:', url.split('/search/')[1]);
				requestQueue.addRequest({ url: url});
				console.log('Added an url with keyword:', syl);
				console.log('Syllables left:', syllables.length);
			} else {
				console.log('\nFinal total companies: ', total_companies);
				process.exit();
			}	*/	
			
			// new requests based on  keywords			
			if (alphabet) { 
				let al = alphabet.pop()
				let url = base_req + al;
				//console.log('url:', url.split('/search/')[1]);
				requestQueue.addRequest({ url: url});
				console.log('Added an url with keyword:', al);
				console.log('alphabet left:', alphabet.length);
			} else {
				console.log('\nFinal total companies: ', total_companies);
				process.exit();
			}
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

	// write total_page_links into file
	var fs = require('fs');
	var json = JSON.stringify(total_page_links);
	//fs.writeFile('total_page_links.json', json, 'utf8');
	fs.writeFile("total_page_links.json", JSON.stringify(total_page_links, null, 4), (err) => {
		if (err) {  console.error(err);  return; };
		console.log("File has been created");
	});
	console.log('Request queue:', requestQueue.getInfo());
	console.log('\nDeleting requestQueue');
	await requestQueue.delete();
	// await queue.addRequest(new Apify.Request({ url: 'http://example.com/foo/bar'}, { forefront: true });

	console.log('\n******** Results ********');
	console.log(' Final total companies: ', total_companies); 
});