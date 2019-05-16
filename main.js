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
*/
var re_turnover = new RegExp("Umsatz.*?[\d,]+.*?[€$]");
Apify.main(async () => { 
	//await login(); // we do init login and save cookie	
	var login_flag = false; 
	var name_text='';
	const dataset = await Apify.openDataset('scraped-info');	
    const requestQueue = await Apify.openRequestQueue(); 
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/daimlerag'});
	requestQueue.addRequest({ url: 'https://www.xing.com/companies/optimussearch'});
    //requestQueue.addRequest({ url: 'https://www.xing.com/companies' });
	//console.log('Request Queue:', requestQueue);
    const pseudoUrls = [new Apify.PseudoUrl('https://www.xing.com/companies/[.+]')];

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		launchPuppeteerOptions: { slowMo: 55 } , 
		gotoFunction: async ({ request, page }) => { 			
			try { 
			    if (!login_flag) { // we login at the first request 
					login_flag = true;  
					await login_page(page);	  
				} 				
				await page.goto(request.url, { timeout: 60000 });
			} catch (error){
				console.log('\nPage request error:', error);
			};  
		},
        handlePageFunction: async ({ request, page }) => {
			await page.waitFor(Math.ceil(Math.random() * 2))			
            try {
				var name_element = await page.$('h1.organization-name');
				name_text = await (await name_element.getProperty('textContent')).jsonValue();
				var company_name = name_text.replace(/\s+/g,'\s'); //.replace(/\n/, '\s');
			} catch(error){
				console.log(`\nNo company name in url: ${request.url}:\n`); //, error);
			}
			if (company_name) {
				// section
				var summary_text='';
				try {
					var summary_element = await page.$('section.facts'); // section.facts > dl > dd:nth-child(1) 
					summary_text = await (await summary_element.getProperty('textContent')).jsonValue();
					//console.log('section.facts: ', summary_text);
				} catch(error){
					console.log(`\nFailure to get summary text for url: ${request.url}: `, error);
				} 
				var about_us='';
				try {
					var about_element = await page.$('div#about-us-content'); 
					about_us = await (await about_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get about section for url: ${request.url}: `, error);
				} 
				var street_address='';
				try {
					var street_element = await page.$('div[itemprop="streetAddress"]');
					street_address = await (await street_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get street address for url: ${request.url}: `, error);
				}
				var post_index='';
				try {
					var index_element = await page.$('*[itemprop="postalCode"]');
					post_index = await (await index_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get post index for url: ${request.url}: `, error);
				}
				var city='';
				try {
					var city_element = await page.$('*[itemprop="addressLocality"]');
					city = await (await city_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get city for url: ${request.url}: `, error);
				} 
				var country='';
				try {
					var country_element = await page.$('*[itemprop="addressCountry"]');
					country = await (await country_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get country for url: ${request.url}: `, error);
				}
				var phone='';
				try {
					var phone_element = await page.$('*[itemprop="telephone"]');
					phone = await (await phone_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get phone number for url: ${request.url}: `, error);
				} 
				var email='';
				try {
					var email_element = await page.$('a[itemprop="email"]');
					email = await (await email_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get email for url: ${request.url}: `, error);
				} 
				var website='';
				try {
					var website_element = await page.$('a[itemprop="url"]');
					website = await (await website_element.getProperty('textContent')).jsonValue();
				} catch(error){
					console.log(`\nFailure to get website  for url: ${request.url}: `, error);
				} 
				console.log(`Company for ${request.url}: ${name_text}`);
				var product_services = '';
				var industry = '';
				try {
					var split1 = summary_text.split("Products and services");
					if (typeof split1[1] !== 'undefined') {
						product_services = split1[1].replace('/\\n/g', '').replace('/\s+/g','\s');  
					} 				
					var split2 = split1[0].split("Industry");
					if (typeof split2[1] !== 'undefined'){
						industry = split2[1] 
					}
				} catch(e) {
					product_services = '';
					industry = '';
					console.log('Failed to get "product_services" or "industry" fields. \nError:',e);
				}
				if (about_us){
					try { 
						var turnover = about_us.match(re_turnover)[0];
					} catch (e) {
						var turnover ='';
						console.log('No "turnover/Umsatz" found.');
					}
				}
				
				await dataset.pushData({ 
					url: request.url,
					name: company_name,
					turnover: turnover,
					//summary : summary_text,
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
            await Apify.utils.enqueueLinks({ page, selector: 'a', pseudoUrls, requestQueue });
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
        maxRequestsPerCrawl: 2,
        maxConcurrency: 2,
    });

    await crawler.run();
	
	console.log('\nDeleting requestQueue');
	await requestQueue.delete();
	
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