const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');

var login_flag = false;
var total_page_links = new Set();
var re_turnover = new RegExp(/Umsatz.*?[\d,]+.*?[€$]/);
var re_employees = new RegExp(/\d+,?\.?\d+/);
var empty_req = {};
var oversise_req = {}; 
var exclude_links_with =['search', 'icons', 'industries', '/img', 'scraping', "application-", "statistics-", "draggable-"];
		
function findAll(regexPattern, sourceString) { 
	let _Set = new Set();
    let match
    // make sure the pattern has the global flag
    let regexPatternWithGlobal = RegExp(regexPattern, "g")
    while (match = regexPatternWithGlobal.exec(sourceString)) { 
		_Set.add(match[0])
    } 
    return _Set
} 

async function printRequestQueue(RequestQueue){
	var { totalRequestCount, handledRequestCount, pendingRequestCount, name } = await requestQueue.getInfo();
	console.log(`Init Request Queue "${name}" with init requests:` );
	console.log(' handledRequestCount:', handledRequestCount);
	console.log(' pendingRequestCount:', pendingRequestCount);
	console.log(' totalRequestCount:'  , totalRequestCount);
}

function check_link(elem) {
	let check_flag=true;
	exclude_links_with.forEach(function(item) { 
		if (elem.includes(item)){
			//console.log(elem ,' includes item of array ', item);
			check_flag = false; 
		}
	});
	return check_flag;
}

function addLinksToRequestQueue(links, requestQueue){
	for (elem of links) {
		//let check_flag = true;
		//check_flag = check_link(elem); 
		if (check_link(elem)){
			requestQueue.addRequest({ url: elem });
			//console.log(' - added:', elem);
		} else {
			//console.log(` - Not added: ${elem}`);
		}
	}
	return requestQueue;
}

function randomInteger(min, max) {
    var rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
  }

function get_account_index(exceptions=[3,5,7,9]){
	let account_index;
	do {
		account_index =	randomInteger(0,9)
	} 
	while (exceptions.includes(account_index));
	return account_index
}

Apify.main(async () => {   
	// we get input from 'default' store (init variables from INPUT json file)
	const store = await Apify.openKeyValueStore();	
	const input = await store.getValue('INPUT'); 
	console.log('input:', input);
	
	var concurrency =  parseInt(input.concurrency);
	var account_index;
	if (!input.account_index) {
		account_index = get_account_index();
	} else {
		account_index = input.account_index;
	}	
	var account = input.account[account_index]; // input.account_index];
	var page_handle_max_wait_time = parseInt( input.page_handle_max_wait_time);
	var max_requests_per_crawl =  parseInt( input.max_requests_per_crawl); 
	var dataset_name  =  input.dataset_name;
	var queue_name  =  input.queue_name;
	var country_parameters='';
	var empl_cat_parameters='';
	var wrong_website_dict = {};
	
	// get countries and employees size from INPUT
	if ( input.hasOwnProperty('crawl') ) { 		
		input.crawl.empl_range.split(',').forEach(function (item, index) {
			console.log(index, 'empl. range [category]:', input.crawl.empl_range);
			empl_cat_parameters += '&filter.size[]=' + item; 
		});	
		if (input.crawl.country) {
			input.crawl.country.split(',').forEach(function (item, index) {
				console.log(index, 'country:', item); //, index, countriesMap[item]);
				country_parameters += '&filter.location[]=' + item; //countriesMap[item];
			});
		}		
	}
	 
	var init_base_req = 'https://www.xing.com/search/companies?sc_o=companies_search_button';
	var base_req = init_base_req + country_parameters + empl_cat_parameters;	
	var base_req_land = init_base_req + empl_cat_parameters;
	console.log('base_req:', [base_req]);
	console.log('base_req_land:', [base_req_land]);
	//process.exit();
	
	// utility variables
	var links_found = {};
	var links_found2 = {};
	var links_found_short = {};
	var links_found_short2 = {};
	const main_link_regex = /(https:\/\/www\.xing\.com)?\/(company|companies)\/[%.\w|-]+/g;
	var page_content='';
	var companies_for_base_search_page = 0;
	var total_companies = 0;
	var counter = 0;	
	var push_data = true;
	var login_failure_counter = 0;
	// dataset
	const dataset = await Apify.openDataset(dataset_name);
	const wrong_website_dataset = await Apify.openDataset('wrong-website-'+base_name);
	// Open existing queue
	console.log(`Opening queue "${queue_name}"...`);
    const requestQueue = await Apify.openRequestQueue(queue_name);  
	// queue info
	var { totalRequestCount, handledRequestCount, pendingRequestCount, name } = await requestQueue.getInfo();
	console.log(`Init Request Queue "${name}" with init requests:` );
	console.log(' handledRequestCount:', handledRequestCount);
	console.log(' pendingRequestCount:', pendingRequestCount);
	console.log(' totalRequestCount:'  , totalRequestCount);		
	
	try{ // add request urls from input.zero_pages_search_file 
		if (input.zero_pages_search_file){	
			//console.log(`Reading file with zero pages` );	
			let contents = fs.readFileSync(input.zero_pages_search_file, 'utf8');
			if (contents!='') {
				let urls = contents.split('\n');
				console.log(`Urls from '${input.zero_pages_search_file}' file to be added to the queue (${urls.length})\n`, urls); 
				let i, counter=0;
				for (i = 0; i < urls.length; i++) { 
					if (urls[i]){
						requestQueue.addRequest({ url: urls[i].trim() });
						counter+=1;
					}
				} 
				console.log(`${counter} url(s) been added from the zero pages file.`);
			}
		}
	} catch (e) { console.log('Error reading file with zero pages:',e); }

	/*if (input.crawl.landern){		
		let landern = input.crawl.landern.split(',');
		console.log(`\nAdding requests from input [Deutschen] landern (${landern.length}).`);
		console.log('Landern indexes:', landern); 
		let i;		
		for (i = 0; i < landern.length  ; i++) {  	
			let url = base_req_land + "&filter.location[]=" + landern[i].trim(); 
			await requestQueue.addRequest({ url: url });
		} 
		console.log(`${i} url(s) been added from 'landern' input.`);
	}*/
	// add request urls from input based landern composed with letters OR only letters
	if (input.letters){	
		let letters = input.letters.split(','); //console.log('letters:', letters); 
		// landern composed with letters
		if (input.crawl.landern_with_letters) {
			let counter=0;
			let i,j;
			let landern = input.crawl.landern_with_letters.split(',');
			for (i = 0; i < landern.length  ; i++) { 
				for (j = 0; j < letters.length  ; j++) {
					//console.log('letter:',letters[j] ,'land:', landern[i]);
					let url = base_req_land + "&filter.location[]=" + landern[i].trim()
					url += "&keywords=" + letters[j].trim(); 
					await requestQueue.addRequest({ url: url });
					counter+=1;
				} 	 
			}
			console.log(`\n${counter} url(s) have been added from 'landern_with_letters' input composed with 'letters' input.`);
		} else { // only letters input (with given countries)			
			console.log(`\nAdding requests from input letters (${letters.length}).`);			
			let i;
			for (i = 0; i < letters.length  ; i++) {  	
				let url = base_req + "&keywords=" + letters[i].trim(); 
				await requestQueue.addRequest({ url: url });
			} 
			console.log(`${i} url(s) been added from letters input.`);
		}
	}
	if (input.crawl.landern_only){
		let landern = input.crawl.landern_only.split(',');
		let counter=0;
		for (let i = 0; i < landern.length  ; i++) {
			let url = base_req_land + "&filter.location[]=" + landern[i].trim() 
			await requestQueue.addRequest({ url: url });
			counter+=1;
		}
		console.log(`\n${counter} url(s) have been added from 'landern_only' input`); 
	}	
	//process.exit();
	// add request urls from input - `init_urls`
	if (input.init_urls){		
		let init_urls = input.init_urls.split(',');
		console.log(`Adding requests from input init_urls (${init_urls.length}).`);
		//console.log('init_urls:', init_urls); 
		let i;
		for (i = 0; i < init_urls.length  ; i++) {  	
			await requestQueue.addRequest({ url: init_urls[i].trim() });
		} 
		console.log(`${i} url(s) been added from input.`);
	}
	 
	var { totalRequestCount, handledRequestCount, pendingRequestCount, name } = await requestQueue.getInfo();
	console.log(`\nRequest Queue "${name}" before the crawl start:` );
	console.log(' handledRequestCount:', handledRequestCount);
	console.log(' pendingRequestCount:', pendingRequestCount);
	console.log(' totalRequestCount:'  , totalRequestCount);
	
	if (!pendingRequestCount){// we add base request		
		await requestQueue.addRequest({ url: base_req });
		console.log('\n Added a BASE REQUEST:', [base_req.split('/sc_o=companies_search_button')[1]]);
	}
	
	console.log('\n Account number:', account_index,'\n');

    // we login before the crawler run to get fresh cookies written into file
	//console.log('Start logging-in...');
	//await login(account.username, account.password, input.cookieFile, 1);
	//console.log('Login is done before the crawler run to get fresh cookies written into file...');
    	
    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		retireInstanceAfterRequestCount: input.retireInstanceAfterRequestCount,
		maxRequestsPerCrawl: max_requests_per_crawl,
        maxConcurrency: concurrency,
		launchPuppeteerOptions: { slowMo: 50 } , 
		gotoFunction: async ({ request, page, puppeteerPool }) => {
			// check login_failure_counter
			if ( login_failure_counter >= concurrency*2 - 1 ) {
				login_failure_counter = 0; // we reset login_failure_counter
				// changing account 				
				let new_account_index = get_account_index();
				do {
					new_account_index = get_account_index();
				} 
				while (new_account_index == account_index);
				account_index = new_account_index;
				account = input.account[account_index];
				console.log(`We have changed account to "${account.username}", account number ${account_index}.`)
			}
			if (!login_flag){
				try{
					console.log('Start logging in...');	
					console.log('  page.url():', page.url());					
					login_res = await login_page(page, account.username, account.password);	
					if (login_res){ 
						console.log(`Success to log in with "${login_res}"\n`);			
						login_flag = true;
					} else {
						console.log(`Failure to log in... with account ${account.username}.\n` );  
					}  
					
				} catch(e){ console.log('Error login_page():', e); }
			}
			// Utility function which strips the variable
			// from window.navigator object
			await Apify.utils.puppeteer.hideWebDriver(page); // 
			const response = page.goto(request.url, { timeout: 70000 }).catch(() => null);
			if (!response) {
				//await puppeteerPool.retire(page.browser());				
				throw new Error(`Page didn't load properly for ${request.url}`);
			}
			return response;			 
		},
        handlePageFunction: async ({ request, page, puppeteerPool }) => {			
			counter+=1
			console.log(`***********************\n ${counter}. Page:`, request.url.split('/companies')[1]);
			await page.waitFor(Math.ceil(Math.random() * page_handle_max_wait_time))	

			if (request.url.includes('/search/companies')) { // processing search page
				console.log(' --- processing a search page');	
				// we need to wait till 				
				// page.$('div.ResultsOverview-style-title-8d816f3f') !='Working on it...'
				/*do {
				    var result = await page.$('div.ResultsOverview-style-title-8d816f3f');
					var companies_num = await (await result.getProperty('textContent')).jsonValue();
					await page.waitFor( 0.5 );
					console.log('\nWe wait 0.5 sec. since "Working on it" is present.');
					console.log('companies_num:', companies_num);
				} while ( companies_num.includes('Working on it'));
				console.log('after loop, companies_num:', companies_num);	
				*/
				if (!request.url.includes('&page=')){ // if this is an initial request/base search page
					try { // we gather the total companies number
						let result = await page.$('div.ResultsOverview-style-title-8d816f3f');
						let companies_num = await (await result.getProperty('textContent')).jsonValue();
						//console.log('\n comp number:', companies_num);
						let amount = parseInt(companies_num.replace(',', '').replace('.', ''));				
						if (!amount && (companies_num.includes('One company') || companies_num.includes('Ein Unternehmen')) ) { 
							amount=1; 
						}
						if (amount){
							//console.log('\nFound amount:', amount);
							companies_for_base_search_page = amount;
							total_companies += amount;				
						} /*else {
							console.log('Companies amount is empty.'); 
						}*/
					} catch(error){
						console.log(`\nNo companies number found for ${request.url}:\n` , error);
					} 
					console.log('Companies for base search page: ', companies_for_base_search_page);
					console.log('Total companies found: ', total_companies, '\n ******************');
					if (  companies_for_base_search_page > 10) { // we create paging sub-requests 
						let max_page = companies_for_base_search_page > 300 ? 30 : Math.ceil(companies_for_base_search_page / 10); 
						if (max_page*10 < companies_for_base_search_page) {
							console.log(`!!! Warning, for the request with keyword {$request.url} the number of companies is {$total_companies}`);							
							oversise_req[request.url.split('?')[1]]=total_companies;
							try{ 
								fs.appendFile(input.oversized_search_file, '\n'+request.url , function (err) {
									if (err) {console.log(`Failure to save ${request.url} into ${input.oversized_search_file}`)}; 
								});	
							} catch (e) {console.log(`Failure to write to "${input.oversized_search_file}"...\nPlease check if file exists.`);}	
							
							//total_companies += amount
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
				//await page.reload();
				page_content = await page.content();
				/*fs.writeFile("temp_page_content.html", page_content, (err) => {
				    if (err) console.log(err);
				    console.log("Successfully written page content to File 'temp_page_content.txt'.");
				});*/  
				// checking 
				/*if (page_content.includes('class="Me-Me')){
					console.log('Found `class="Me-Me`');
					login_flag=true;
				}*/
				
				links_found = findAll(main_link_regex, page_content);
				 
				for (elem of links_found) { 
					if ( !elem.startsWith('https://www.xing.com')){
						let new_elem = 'https://www.xing.com'+elem;
						links_found.delete(elem);
						links_found.add(new_elem);
						//total_page_links.add(new_elem);
					} /*else {
						total_page_links.add(elem);
					}	*/							
				}
				//await links_store.setValue('scraped_urls', links_found );
				console.log('FOUND LINKS at "'+ request.url.split('companies_search_button&')[1] +'": (', links_found.size, ')'); //\n', links_found );		
				// console.log('TOTAL LINKS GATHERED:',   total_page_links.size  );	
				// process  pages with 0 links found
				if (links_found.size==0){
					empty_req[counter] = request.url;
					fs.appendFile(input.zero_pages_search_file, "\n"+request.url , function (err) {
					    if (err) {console.log(`Failure to save ${request.url} into ${input.zero_pages_search_file}`)}; 
					});	
				}
				// save company links into requestQueue
				addLinksToRequestQueue(links_found, requestQueue); // The queue can only contain unique URLs.
				//addLinksToRequestQueue(links_found2, requestQueue); 
			
			} else { // processing company page 
				console.log(' --- processing a company page:', request.url.split('/companies')[1]);
				page_content='';
				try {
					//gather_info_into_dataset(page);
					var company_name='';
					/*try{
						let login_sign = await page.$('span.myxing-profile-name');
						if (login_sign){
							console.log('Found  `span.myxing-profile-name` ...');
							login_flag=true;
						}
					} catch(err){
						console.log('Failure to find `span.myxing-profile-name`');
					}*/
					try { // get name of the company
						var name_element = await page.$('h1.organization-name');
						company_name = await (await name_element.getProperty('textContent')).jsonValue();
						var company_name = company_name.trim();  
					} catch(error){
						//console.log(`\nNo company name in url: ${request.url}:\n`); //, error);
					}
					if (company_name) { // get info from page's html and saving into dataset
						// section
						push_data = true;
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
							if (website=='https://www.xing.com/' || website.toLowerCase()=='homepage'){ 
								// we store wrong website value	 								
								await wrong_website_dataset.pushData({ 
									url: request.url, 
									website: website
								});
								//requestQueue.reclaimRequest(request, {forefront : true});
								push_data = false; // we do not push data into dataset
							}
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
									employees_range = split3[1].trim().split('.').join('');  
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
									employees_num = employees_num.replace(',', '').replace('.', '');
								} 
							} catch(e){
								//console.log('No employees number found.');
							}
						}
						if (push_data) { 						
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
					}
				} catch (e) { console.log(e); }				
			}  			
			// let's check login 
			console.log('We check before leaving the page...');
			if (page_content) {
				login_check = await check_if_logged_in(page, page_content);			
			} else {
				login_check = await check_if_logged_in(page);
			}
			if (login_check){
				console.log(`Logged "${login_check}", account: ${account_index}.`);			
				login_flag = true;
				 
			} else {
				console.log('Warning! Not logged-in for the page!');
				login_flag = false; 
				login_failure_counter += 1;
			}	
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
	/*
	// write total_page_links into file 
	var json = JSON.stringify(total_page_links);
	//fs.writeFile('total_page_links.json', json, 'utf8');
	fs.writeFile("total_page_links.json", JSON.stringify(total_page_links, null, 4), (err) => {
		if (err) {  console.error(err);  return; };
		console.log("File 'total_page_links.json' has been created");
	});*/
	
	// print final queue
	var { totalRequestCount, handledRequestCount, pendingRequestCount } = await requestQueue.getInfo();
	console.log('Final RequestQueue\n handled:', handledRequestCount);
	console.log(' pending:', pendingRequestCount);
	console.log(' total:'  , totalRequestCount);
	
	console.log('************\nEmpty requests:', empty_req);
	console.log('Oversized requests:', oversise_req);
	
	console.log('\n******** Results ********');
	console.log('TOTAL COMPANY LINKS number: ', total_companies);  
	console.log('TOTAL GATHERED LINKS number:', total_page_links.size  );
	
	const data = await dataset.getData().then((response) => response.items);
	await Apify.setValue(input.output, data);
	 
	const { itemCount } = await dataset.getInfo();
	console.log('\nTotal items in dataset: ', itemCount);
});