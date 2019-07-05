const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');
//process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";
//process.env.APIFY_MEMORY_MBYTES = 2000;
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
13. Employees number - employees_num
14. Employees range - employees_range
*/ 

var login_flag = false;
var re_turnover = new RegExp(/Umsatz.*?[\d,]+.*?[€$]/);
var re_employees = new RegExp(/\d+,?\d+/);
var account = {};
var countries='';
var countriesMap = new Map([[ 'germany': 2921044 ],['austria': 2782113 ],[ 'switzerland': 2658434 ]]);

//var countriesMap = ;
var categoriesMap = new Map([{'over_10000': 9 }]);
//var categoriesMap = ; 
var syllables = ['BA','BE','BI','BO','BU','BY','CA','CE','CI','CO','CU','CY','DA','DE','DI','DO','DU','DY','FA','FE','FI','FO','FU','FY','GA','GE','GI','GO','GU','GY','HA','HE','HI','HO','HU','HY','JA','JE','JI','JO','JU','JY','KA','KE','KI','KO','KU','KY','LA','LE','LI','LO','LU','LY','MA','ME','MI', 'MO','MU','MY','NA','NE','NI','NO','NU','NY','PA','PE','PI','PO','PU','PY','QA','QE','QI','QO','QU','QY','RA','RE','RI','RO','RU','RY','SA','SE','SI','SO','SU','SY','TA','TE','TI','TO','TU','TY','VA','VE','VI','VO','VU','VY','WA','WE','WI','WO','WU','WY','XA','XE','XI','XO','XU','XY' ].reverse();
var get_parameters=''; 
//process.exit();

process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
  if (val.startsWith('country=')) {
	  countries = val.split('country=')[1]; 
  }
}); 

/*countries.split(',').forEach(function (item, index) {
    //console.log(item, index, countriesMap[item]);
    get_parameters += '&filter.location[]='+countriesMap[item];
});
//console.log('get_parameters:', get_parameters);

var companies_req = 'https://www.xing.com/search/companies?filter.size[]=9' + get_parameters
console.log('\ncompanies_req:', companies_req);
*/
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
	const store = await Apify.openKeyValueStore('default');
	const input = await store.getValue('INPUT-ge');
	//console.log('\ncustom input:', input);
	//process.exit(); 
	// init variables from INPUT json file - apify_storage/key_value_stores/default/INPUT.json
	/*if (!custom_input) { 
		const input = await Apify.getInput(); // https://sdk.apify.com/docs/api/apify#module_Apify.getInput
	} else {
		const input = custom_input;
	}*/
	//console.log('\n[custom] input:', input);
	var concurrency =  parseInt(input.concurrency);
	accounts = input.account; 
	/*for (let item in accounts) {
	   console.log(item,':' ,accounts[item]);
	}*/
	let account = accounts[input.account_index];
	console.log( '\n We select "account',  input.account_index,'" : ' ,account );
	
	//await login(account.username, account.password, input.cookieFile);
	//console.log('after login...');
	//process.exit();
	var page_handle_max_wait_time = parseInt( input.page_handle_max_wait_time);
	var max_requests_per_crawl =  parseInt( input.max_requests_per_crawl);
	const main_link_regex = /(https:\/\/www\.xing\.com)?\/(company|companies)\/[\w|-]+/g;
	const link_regex = /(https:\/\/www\.xing\.com\/companies\/[\w|-]+)/g;
	const short_link_regex = /\/companies\/[\w|-]+/g;
	var links_found = {};
	var links_found_short = {};
	var page_content=''; 
	//console.log('\ninput.username:' , input.username, '\ninput.password:', input.password);
	
	// get countries and employees size from INPUT
	if ( input.hasOwnProperty('crawl') ) {
		input.crawl.country.split(',').forEach(function (item, index) {
			console.log(index, 'country:', item); //, index, countriesMap[item]);
			get_parameters += '&filter.location[]=' + countriesMap[item];
		});
		
		input.crawl.empl_range.split(',').forEach(function (item, index) {
			console.log(index, 'empl. range [category]:', input.crawl.empl_range);
			get_parameters += '&filter.size[]=' + item; 
		});
	}
	
	//var companies_req = 'https://www.xing.com/search/companies?section=search&sc_o=companies_search_button' + get_parameters; //.substring(1);
	//console.log('\ncompanies_req:', companies_req);
	
	const dataset = await Apify.openDataset('test_dataset3');	
    const requestQueue = await Apify.openRequestQueue('test_queue3');  
	
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/daimlerag'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/optimussearch'});
	/*requestQueue.addRequest({ url: 'https://www.xing.com/companies/4bag'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/iav'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/mercedes-amggmbh'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/siselinternational'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/allianzdeutschlandag'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/mercedes-benzcustomersolutionsgmbh'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/intel'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/murataelektronikgmbh'});
	*/
	
	//requestQueue.addRequest({ url: 'https://www.xing.com/search/companies?section=search'});
    //requestQueue.addRequest({ url:  companies_req});
	
	//requestQueue.addRequest({ url: 'https://www.xing.com/companies' });
	//requestQueue.addRequest({ url: 'https://www.xing.com/companies/recommendations' });
	//requestQueue.addRequest({ url: 'https://www.xing.com/companies/recommendations?page=2'});
	
	//const pseudoUrls = [new Apify.PseudoUrl('https://www.xing.com/companies/[.+]')];
	//const pseudoUrls = [new Apify.PseudoUrl(/https:\/\/www\.xing\.com\/companies\/(\w|-)+(?!\/jobs|\/report|\/affiliations|\/follower|\/search|\/reviews|\/industries|\/updates|\/employees)/gm)];
	//const pseudoUrls = [new Apify.PseudoUrl(/https:\/\/www\.xing\.com\/companies\/(\w|-)*/)];
	// hint for multiple negative lookahead: https://stackoverflow.com/a/47281442/1230477
	// link to test: https://regex101.com/r/JFIUff/1
//	console.log('Start logging-in...');
	//await login(account.username, account.password, input.cookieFile, 1);
	//console.log('Login is done before the crawler run to get fresh cookies written into file...');
   
    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		maxRequestsPerCrawl: max_requests_per_crawl,
        maxConcurrency: concurrency,
		launchPuppeteerOptions: { slowMo: 205 } , 
		gotoFunction: async ({ request, page }) => { 			
			try { 
			    if (!login_flag) { // we login at the first request 
					//await set_cookie(page);
					await login_page(page, account.username, account.password, input.cookieFile);
					//console.log('Cookie is set for log-in!');					
				} 	
				await page.goto(request.url, { timeout: 60000 });
			} catch (error){
				console.log('\nPage request error:', error);
			};  
		},
        handlePageFunction: async ({ request, page }) => {
			// we change the flag
			if (!login_flag) { login_flag = true; }
			
			await page.waitFor(Math.ceil(Math.random() * page_handle_max_wait_time))
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
					// alternative: await page.$eval('a[itemprop="url"]', (el) => el.href)
					var website_element = await page.$('a[itemprop="url"]');  
					website = await (await website_element.getProperty('href')).jsonValue(); 
					if (!website || website == "Homepage") {
						console.log(`problem, website: "${website}" \nfor url "${request.url}"`);
					}	 
				} catch(error){
					//console.log(`\nFailure to get "website" for url: ${request.url}: `, error);
				} 
				console.log(`Company for ${request.url}: ${company_name}`);
				var product_services = '';
				var industry = '';
				try {
					let split1 = summary_text.split("Products and services");
					if (typeof split1[1] !== 'undefined') {
						product_services = split1[1].trim();  
					} else {
						split1 = summary_text.split("Produkte und Services");
						if (typeof split1[1] !== 'undefined') {
							product_services = split1[1].trim();  
						}
					}			
					let split2 = split1[0].split("Industry");
					if (typeof split2[1] !== 'undefined'){
						industry = split2[1].trim(); 						
					} else {
						split2 = split1[0].split("Branche");
						if (typeof split2[1] !== 'undefined') {
							industry = split2[1].trim();  
						}
					}
					let split3 = split2[0].split("Year of establishment")[0].split('Employees'); 
					if (typeof split3[1] !== 'undefined'){
						employees_range = split3[1].trim().split(',').join(''); 						
					} else {
						split3 = split2[0].split("Gründungsjahr")[0].split('Unternehmensgröße');
						if (typeof split3[1] !== 'undefined') {
							employees_range = split3[1].trim().split(',').join('');  
						}
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
			
			
			// we gather links
			if (request.url.includes('/search/companies')) {
				page_content = await page.content();
				links_found  =  findAll(link_regex, page_content);
				links_found_short =  findAll(short_link_regex, page_content);  			
				
				for (elem of links_found_short) {
					links_found.add('https://www.xing.com'+elem);	 
				} 
				console.log('FOUND LINKS at "'+ request.url +'": (', links_found.size, ')\n', links_found );
				// add those links
				addLinksToRequestQueue(links_found, requestQueue);
				
				// add a next companies request
				let page = parseInt(request.url.split('page=')[1].split('&')[0]);	
				if (isNaN(page)) { page=1; }	
				page +=1;
				console.log('\n next companies page (index) to crawl :', page);
			}
			
			// print queue
			var { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();
			console.log('RequestQueue\n handled:', handledRequestCount);
			console.log(' pending:', pendingRequestCount);
			console.log(' total:'  , totalRequestCount);
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },        
    });

    await crawler.run();
 
	if (input.deleteQueue) {
		console.log('\nDeleting requestQueue');
		await requestQueue.delete();
	}
	// await queue.addRequest(new Apify.Request({ url: 'http://example.com/foo/bar'}, { forefront: true });

	console.log('\n******** Results ********');	 
	// print final queue
	var { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();
	console.log('Final RequestQueue\n handled:', handledRequestCount);
	console.log(' pending:', pendingRequestCount);
	console.log(' total:'  , totalRequestCount);
	
	const data = await dataset.getData().then((response) => response.items);
	await Apify.setValue(input.output, data);
	 
	const { itemCount } = await dataset.getInfo();
	console.log('\nTotal items in dataset: ', itemCount);
});