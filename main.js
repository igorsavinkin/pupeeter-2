const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');
process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";
process.env.APIFY_MEMORY_MBYTES = 2000;
/*
1. Company Name - name
2. Xing Link - url
3. Adresse (Straße) - street_address
4. Adresse (PLZ) - post_index
5. Adresse (Stadt) - city
6. Adresse (Land) - country
7. Telefon - phone
8. E-Mail  - email
9. Website - site
10. Produkte & Services - product_services
11. Branche - industry
12. Unternehmensgröße - about_us - turnover
13. Employes - employees
*/ 

var login_flag = false;
var re_turnover = new RegExp(/Umsatz.*?[\d,]+.*?[€$]/);
var re_employees = new RegExp(/\d+,?\d+/);

function getValidRequest(request, queue){ 
	while ( request.url.includes('/employees') || 
			request.url.includes('/industries')  ||
			request.url.includes('/reviews')  ) 
			request.url.includes('/employees') || 
			request.url.includes('/industries')  ||
			request.url.includes('/updates') ||
			request.url.includes('/follower') ||
			request.url.includes('.json') ||
			request.url.includes('/jobs') ||
			request.url.includes('/report') ||
			request.url.includes('/affiliations') ||
			request.url.includes('/follower') ||
			request.url.includes('/search')  ||						
			request.url.includes('/reviews')  
	{ 
		console.log(' Found a wrong request: ', request.url.split('/companies')[1]);
	    request = queue.fetchNextRequest();
	}
	return request;
}
function printRequestQueue (requestQueue){
	var { totalRequestCount, handledRequestCount, pendingRequestCount } = requestQueue.getInfo();	
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
			&& !name.startsWith("draggable-")){
			requestQueue.addRequest({ url: elem });
			console.log('added:', elem);
		} else {
			console.log('NOT added - ', elem);
		}
	}
	return requestQueue;
}
Apify.main(async () => {  
	//await login(); // we do init login and save cookie

	// init variables from INPUT json file - apify_storage/key_value_stores/default/INPUT.json
	const input = await Apify.getInput(); // https://sdk.apify.com/docs/api/apify#module_Apify.getInput
	var concurrency =  parseInt(input.concurrency);
	var page_handle_max_wait_time = parseInt( input.page_handle_max_wait_time);
	var max_requests_per_crawl =  parseInt( input.max_requests_per_crawl);
	const link_regex = /(https:\/\/www\.xing\.com\/companies\/[\w|-]+)/g;
	const short_link_regex = /\/companies\/[\w|-]+/g;
	var links_found={};
	var links_found2 = {};
	var page_content=''; 
	//console.log('\ninput.username:' , input.username, '\ninput.password:', input.password);
	
	const dataset = await Apify.openDataset('scraped-info');	
    const requestQueue = await Apify.openRequestQueue();  
	//requestQueue.addRequest({ url: 'https://www.xing.com/companies/daimlerag'});
	//requestQueue.addRequest({ url: 'https://www.xing.com/companies/optimussearch'});
    requestQueue.addRequest({ url: 'https://www.xing.com/companies' });
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/recommendations' });
	//console.log('Request Queue:', requestQueue);
    //const pseudoUrls = [new Apify.PseudoUrl('https://www.xing.com/companies/[.+]')];
	//const pseudoUrls = [new Apify.PseudoUrl(/https:\/\/www\.xing\.com\/companies\/(\w|-)+(?!\/jobs|\/report|\/affiliations|\/follower|\/search|\/reviews|\/industries|\/updates|\/employees)/gm)];
	const pseudoUrls = [new Apify.PseudoUrl(/https:\/\/www\.xing\.com\/companies\/(\w|-)*/)];
	// hint for multiple negative lookahead: https://stackoverflow.com/a/47281442/1230477
	// link to test: https://regex101.com/r/JFIUff/1
	const regexp = /\//g;
    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		maxRequestsPerCrawl: max_requests_per_crawl,
        maxConcurrency: concurrency,
		launchPuppeteerOptions: { slowMo: 45 } , 
		gotoFunction: async ({ request, page }) => { 			
			try { 
			    if (!login_flag) { // we login at the first request 
					login_flag = true;  
					console.log('\n\n Request Queue:\n', requestQueue);
					await login_page(page, input.username, input.password, input.cookieFile);					
				} 	 
				// requestQueue
				//printRequestQueue (requestQueue);
				//var { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();	
				//console.log('\nRequest Queue:\n   total:', totalRequestCount); 
				//console.log('   handled:', handledRequestCount, '\n   pending:', pendingRequestCount);	
				//if (pseudoUrls[0].matches(request.url)) console.log(request.url.split('/companies')[1], ' matches pseudoUrls.');	
				 
				/*while (!request.url || [request.url.match(regexp)][0].length > 4){
					if (request.url) console.log(' !!!!!! slashes number in a request.url:', [request.url.match(regexp)][0].length)
					request = requestQueue.fetchNextRequest();
				} 
				console.log('request.url:', request.url.split('/companies')[1]);
				console.log(' slashes number in a request.url:', [request.url.match(regexp)][0].length)
				*/
				/*while ( !request.url ||
				        request.url.includes('/employees') || 
						request.url.includes('/industries')  ||
						request.url.includes('/updates') ||
						request.url.includes('/followers') ||
						request.url.includes('.json') ||
						request.url.includes('/jobs') ||
						request.url.includes('/report') ||
						request.url.includes('/affiliations') ||
						request.url.includes('/follower') ||
						request.url.includes('/search')  ||						
						request.url.includes('/reviews')  
					) 
				{ 					
					if (request.url) {
						console.log('--wrong req-st:', request.url.split('companies')[1]);
					}
					//try {
					//	requestQueue.markRequestHandled(request);
					//} catch(e) {
					//	console.log(e); 
					//}
					//request.handledAt = "2019-05-27T13:53:57.169Z";					 
					
				} */
				//request = getValidRequest(request, requestQueue);
				//console.log('\nValid request:', request);
				// show requestQueue
				/*let i=0; 
				while (!requestQueue.isEmpty() ){
					let request = requestQueue.fetchNextRequest();
					console.log(i, ' request: ', request);
					i+=1;
				}*/
				
				
				await page.goto(request.url, { timeout: 60000 });
			} catch (error){
				console.log('\nPage request error:', error);
			};  
		},
        handlePageFunction: async ({ request, page }) => {
			await page.waitFor(Math.ceil(Math.random() * page_handle_max_wait_time))
			var company_name='';
		
		
            try {
				var name_element = await page.$('h1.organization-name');
				company_name = await (await name_element.getProperty('textContent')).jsonValue();
				var company_name = company_name.trim();  
			} catch(error){
				//console.log(`\nNo company name in url: ${request.url}:\n`); //, error);
			}
			if (company_name) {
				// section
				var summary_text='';
				try {
					var summary_element = await page.$('section.facts'); // section.facts > dl > dd:nth-child(1) 
					summary_text = await (await summary_element.getProperty('textContent')).jsonValue();
					//console.log('section.facts: ', summary_text);
				} catch(error){
					//console.log(`\nFailure to get summary text for url: ${request.url}: `, error);
				} 
				var about_us='';
				try {
					var about_element = await page.$('div#about-us-content'); 
					about_us = await (await about_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get about section for url: ${request.url}: `, error);
				} 
				var employees='';
				try {
					var employees_element = await page.$('li#employees-tab > a'); 
					employees = await (await employees_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get about section for url: ${request.url}: `, error);
				} 
				var street_address='';
				try {
					var street_element = await page.$('div[itemprop="streetAddress"]');
					street_address = await (await street_element.getProperty('textContent')).jsonValue(); //.trim();
				} catch(error){
					//console.log(`\nFailure to get street address for url: ${request.url}: `, error);
				}
				var post_index='';
				try {
					var index_element = await page.$('*[itemprop="postalCode"]');
					post_index = await (await index_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get post index for url: ${request.url}: `, error);
				}
				var city='';
				try {
					var city_element = await page.$('*[itemprop="addressLocality"]');
					city = await (await city_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get city for url: ${request.url}: `, error);
				} 
				var country='';
				try {
					var country_element = await page.$('*[itemprop="addressCountry"]');
					country = await (await country_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get country for url: ${request.url}: `, error);
				}
				var phone='';
				try {
					var phone_element = await page.$('*[itemprop="telephone"]');
					phone = await (await phone_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get phone number for url: ${request.url}: `, error);
				} 
				var email='';
				try {
					var email_element = await page.$('a[itemprop="email"]');
					email = await (await email_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get email for url: ${request.url}: `, error);
				} 
				var website='';
				try {
					var website_element = await page.$('a[itemprop="url"]');
					website = await (await website_element.getProperty('textContent')).jsonValue();
				} catch(error){
					//console.log(`\nFailure to get website  for url: ${request.url}: `, error);
				} 
				console.log(`Company for ${request.url}: ${company_name}`);
				var product_services = '';
				var industry = '';
				try {
					var split1 = summary_text.split("Products and services");
					if (typeof split1[1] !== 'undefined') {
						product_services = split1[1].trim();  
					} 				
					var split2 = split1[0].split("Industry");
					if (typeof split2[1] !== 'undefined'){
						industry = split2[1].trim(); 
					}
				} catch(e) {
					//console.log('Failed to get "product_services" or "industry" fields. \nError:',e);
				}
				if (about_us){
					try { 
						var turnover = about_us.match(re_turnover)[0];
					} catch (e) {
						var turnover ='';
						//console.log('No "turnover/Umsatz" found.');
					}
				}
				var employees_num='';
				if (employees){
					try { employees_num = employees.match(re_employees)[0]; 
					    if (employees_num){
							employees_num=employees_num.replace(',', '');
						} 
					} catch(e){
						//console.log('No employees number found.');
					}
				}
				
				await dataset.pushData({ 
					url: request.url,
					name: company_name,
					turnover: turnover,
					employees_num : employees_num,
					industry: industry,
					product_services: product_services,					
					street_address: street_address,
					post_index: post_index,
					city: city,
					country: country,
					phone: phone,
					email: email,
					website: website,
					//about_us, about_us		
				});
			}
			page_content = await page.content();
			links_found = findAll(link_regex, page_content);
			console.log('FOUND LINKS:', links_found );
			links_found2 =  findAll(short_link_regex, page_content); 
			console.log('FOUND SHORT LINKS:', links_found2 );
			
			
			// add links to requestQueue
			/*for (elem of links_found) {
			     requestQueue.addRequest({ url: elem});
			      console.log('added', elem);
			}*/
			for (elem of links_found2) {
				links_found.add('https://www.xing.com'+elem);	 
			} 
			addLinksToRequestQueue(links_found, requestQueue);
			//addLinksToRequestQueue(links_found2, requestQueue);
			
            //await Apify.utils.enqueueLinks({ page, selector: 'a', pseudoUrls, requestQueue });
			// https://sdk.apify.com/docs/api/pseudourl
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
        
    });

    await crawler.run();
	//printRequestQueue (requestQueue);
	console.log('\nDeleting requestQueue');
	await requestQueue.delete();
	// await queue.addRequest(new Apify.Request({ url: 'http://example.com/foo/bar'}, { forefront: true });

	console.log('\n******** Results ********');
	/*var obj = { companies: [] };	 
	await dataset.forEach(async (item, index) => {		
	    if (item.name) { 
			obj.companies.push(item);
			console.log(`${index}. "${item.name}" ${item.url}`); 
			//if (item.summary ) { console.log(item.summary ); }
			//if (item.contact ) { console.log(item.contact ); }
		}
	});*/
	const data = await dataset.getData().then((response) => response.items);
	await Apify.setValue('OUTPUT', data);
	 
	const { itemCount } = await dataset.getInfo();
	console.log('\nTotal items in dataset: ', itemCount);
});