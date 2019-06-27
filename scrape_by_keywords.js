const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');

var login_flag = false;
var total_page_links = new Set();
var re_turnover = new RegExp(/Umsatz.*?[\d,]+.*?[€$]/);
var re_employees = new RegExp(/\d+,?\d+/);
var empty_req = {};
var oversise_req = {}; 
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
async function printRequestQueue(RequestQueue){
	let { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();	
	console.log('\nRequest Queue:\n   total:', totalRequestCount); 
	console.log('   handled:', handledRequestCount, '\n   pending:', pendingRequestCount);	
	return {totalRequestCount, handledRequestCount, pendingRequestCount};
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
	//const input = await Apify.getInput(); // https://sdk.apify.com/docs/api/apify#module_Apify.getInput
	const store = await Apify.openKeyValueStore('default');
	
	const input = await store.getValue('INPUT-ger-10000');
	
	var concurrency =  parseInt(input.concurrency);
	var account = input.account[input.account_index];
	//var syllables = ['BA','BE','BI','BO','BU','BY','CA','CE','CI','CO','CU','CY','DA','DE','DI','DO','DU','DY','FA','FE','FI','FO','FU','FY','GA','GE','GI','GO','GU','GY','HA','HE','HI','HO','HU','HY','JA','JE','JI','JO','JU','JY','KA','KE','KI','KO','KU','KY','LA','LE','LI','LO','LU','LY','MA','ME','MI', 'MO','MU','MY','NA','NE','NI','NO','NU','NY','PA','PE','PI','PO','PU','PY','QA','QE','QI','QO','QU','QY','RA','RE','RI','RO','RU','RY','SA','SE','SI','SO','SU','SY','TA','TE','TI','TO','TU','TY','VA','VE','VI','VO','VU','VY','WA','WE','WI','WO','WU','WY','XA','XE','XI','XO','XU','XY' ].reverse();
	//var alphabet = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
	// process.exit();
	var page_handle_max_wait_time = parseInt( input.page_handle_max_wait_time);
	var max_requests_per_crawl =  parseInt( input.max_requests_per_crawl); 
	
	
	var links_found = {};
	var links_found_short = {};
	const link_regex = /(https:\/\/www\.xing\.com\/companies\/[\w|-]+)/g;
	const short_link_regex = /\/companies\/[\w|-]+/g; 
	var page_content='';
	var total_companies = 0;
	var base_req = 'https://www.xing.com/search/companies?sc_o=companies_search_button&filter.location[]=2921044&filter.size[]=9&keywords='	
	var counter=0;	
	
	const dataset = await Apify.openDataset('ger-10000+');
	
	console.log('opening queue "ger-10000+"...');
    const requestQueue = await Apify.openRequestQueue('ger-10000+');  
	
	var { totalRequestCount, handledRequestCount, pendingRequestCount, name } = await requestQueue.getInfo();
	console.log(`Init Request Queue "${name}".` );
	console.log(' handledRequestCount:', handledRequestCount);
	console.log(' pendingRequestCount:', pendingRequestCount);
	console.log(' totalRequestCount:'  , totalRequestCount);
	
	/*
	requestQueue.addRequest({ url: 'https://www.xing.com/signup?login=1'});
	 
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/iav'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/mercedes-amggmbh'});
	 */
	requestQueue.addRequest({ url: 'https://www.xing.com/search/companies?sc_o=companies_search_button&filter.location[]=2921044&filter.size[]=9&keywords=e'});
	/*requestQueue.addRequest({ url: 'https://www.xing.com/search/companies?sc_o=companies_search_button&filter.location[]=2921044&filter.size[]=9&keywords=c'});
    */
	requestQueue.addRequest({ url: 'https://www.xing.com/search/companies?sc_o=companies_search_button&filter.location[]=2921044&filter.size[]=9&keywords=f'});
	
	//process.exit();
	// add request urls from input
	/*if (input.init_urls){		
		var init_urls = input.init_urls.split(',');
		console.log(init_urls);
		for (let i = 0; i <= init_urls.length ; i++) { 
		    console.log(`adding: ${init_urls[i]}` );
			requestQueue.addRequest({ url: 	init_urls[i] });			
		}
	}*/
	
	// Open a named key-value store
    const links_store = await Apify.openKeyValueStore('links_store');
	
    // we login before the crawler run to get fresh cookies written into file
	//console.log('Start logging-in...');
	//await login(account.username, account.password, input.cookieFile, 1);
	//console.log('Login is done before the crawler run to get fresh cookies written into file...');
    
	
    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		maxRequestsPerCrawl: max_requests_per_crawl,
        maxConcurrency: concurrency,
		launchPuppeteerOptions: { slowMo: 55 } , 
		gotoFunction: async ({ request, page }) => { 			
			try { 
			    if (!login_flag) { // we login until the `login_flag` is off/false 			
					try{	 
						//await set_cookie(page);
						// console.log('Cookie is set for log-in!');
						await login_page(page, account.username, account.password, input.cookieFile);	
						console.log('Success to log in!');
						//await page.reload();
						//await page.waitFor(45);
					} catch(e){ console.log('Error setting cookies:', e); }
				} 	
				await page.goto(request.url, { timeout: 60000 });
			} catch (error){
				console.log('\nPage request error:', error);
			};  
		},
        handlePageFunction: async ({ request, page }) => {
			if (!login_flag) { login_flag = true; }
			counter+=1
			console.log(`***********************\n ${counter}. Page:`, request.url.split('/companies')[1]);
			await page.waitFor(Math.ceil(Math.random() * page_handle_max_wait_time))	

			if (request.url.includes('/search/companies')) { // processing search page
				console.log('  processing search page');			
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
					if (  total_companies > 10) { // we create paging sub-requests 
						let max_page = total_companies > 300 ? 30 : Math.ceil(total_companies / 10); 
						if (max_page*10 < total_companies) {
							console.log(`!!! Warning, for the request with keyword {$request.url} the number of companies is {$total_companies}`);							
							oversise_req[request.url.split('?')[1]]=total_companies;
						}
						console.log('paging sub-requests to ', request.url.split('?')[1]);
						for (let i = 2; i <= max_page ; i++) { 
							let url = request.url + '&page=' + i.toString()					
							requestQueue.addRequest({ url: url });					
							console.log(' - added a paging request: page='+ i.toString());
						}				
					}
				}
				// gather company links
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
				console.log('FOUND LINKS at "'+ request.url.split('?')[1] +'": (', links_found.size, ')\n', links_found );		
				console.log('TOTAL LINKS GATHERED:',   total_page_links.size  );		
				if (links_found.size==0){
					empty_req[counter] = request.url; 
				}
				// save company links into requestQueue
				addLinksToRequestQueue(links_found, requestQueue); // The queue can only contain unique URLs.
			
			} else { // processing company page 
				console.log('  processing company page:', request.url.split('/companies')[1]);
				try {
					//gather_info_into_dataset(page);
					var company_name='';
					try { // get name of the company
						var name_element = await page.$('h1.organization-name');
						company_name = await (await name_element.getProperty('textContent')).jsonValue();
						var company_name = company_name.trim();  
					} catch(error){
						//console.log(`\nNo company name in url: ${request.url}:\n`); //, error);
					}
					if (company_name) { // get info from page's html and saving into dataset
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
							website = await (await website_element.getProperty('href')).jsonValue();
						} catch(error){
							console.log(`\nFailure to get website  for url: ${request.url}: `, error);
						} 
						console.log(`Company for ${request.url}: ${company_name}`);
						var product_services = '';
						var industry = '';
						try {
							let split1 = summary_text.split("Products and services");
							if (typeof split1[1] !== 'undefined') {
								product_services = split1[1].trim();  
							} 				
							let split2 = split1[0].split("Industry");
							if (typeof split2[1] !== 'undefined'){
								industry = split2[1].trim(); 						
							}
							let split3 = split2[0].split("Year of establishment")[0].split('Employees');
							if (typeof split3[1] !== 'undefined'){
								employees_range = split3[1].trim().split(',').join(''); 						
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
									employees_num = employees_num.replace(',', '');
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
							employees_range : employees_range,
							industry: industry,
							product_services: product_services,					
							street_address: street_address,
							post_index: post_index,
							city: city,
							country: country,
							phone: phone,
							email: email,
							website: website,		
						});
					}
				} catch (e) { console.log(e); }				
			}  
			
			
			
			var { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();
			console.log('RequestQueue\n handled:', handledRequestCount);
			console.log(' pending:', pendingRequestCount);
			console.log(' total:'  , totalRequestCount);
			
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
			/*
						
			if (alphabet) { // new requests based on  keywords
				let al = alphabet.pop()
				let url = base_req + al;
				//console.log('url:', url.split('/search/')[1]);
				requestQueue.addRequest({ url: url});
				console.log('Added an url with keyword:', al);
				console.log('alphabet left:', alphabet.length);
			} else {
				console.log('\nFinal total companies: ', total_companies);
				process.exit();
			}*/
			//await printRequestQueue(requestQueue);
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

	if (input.deleteQueue) {
		console.log('\nDeleting requestQueue');
		await requestQueue.delete();
	}
	
	// write total_page_links into file 
	var json = JSON.stringify(total_page_links);
	//fs.writeFile('total_page_links.json', json, 'utf8');
	fs.writeFile("total_page_links.json", JSON.stringify(total_page_links, null, 4), (err) => {
		if (err) {  console.error(err);  return; };
		console.log("File 'total_page_links.json' has been created");
	});
	
	// print final queue
	var { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();
	console.log('Final RequestQueue\n handled:', handledRequestCount);
	console.log(' pending:', pendingRequestCount);
	console.log(' total:'  , totalRequestCount);
	
	console.log('************\nEmpty requests:', empty_req);
	console.log('Oversized requests:', oversise_req);
	console.log('\n******** Results ********');
	console.log(' Final total companies: ', total_companies); 
	
	const data = await dataset.getData().then((response) => response.items);
	await Apify.setValue(input.output, data);
	 
	const { itemCount } = await dataset.getInfo();
	console.log('\nTotal items in dataset: ', itemCount);
});