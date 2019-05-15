const fs = require('fs');	
const Apify = require('apify');
const puppeteer = require('puppeteer');
require('./login-xing.js');
process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";

Apify.main(async () => { 
	//await login(); // we do init login and save cookie	
	var login_flag = false; 
	var name_text='';
	const dataset = await Apify.openDataset('scraped-info');	
    const requestQueue = await Apify.openRequestQueue(); 
    requestQueue.addRequest({ url: 'https://www.xing.com/companies' });
	//console.log('Request Queue:', requestQueue);
    const pseudoUrls = [new Apify.PseudoUrl('https://www.xing.com/companies/[.+]')];

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue, 
		launchPuppeteerOptions: { slowMo: 70 } , 
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
			// company name ;			
            try {
				var name_element = await page.$('h1.organization-name');
				name_text = await (await name_element.getProperty('textContent')).jsonValue();
				var company_name = name_text.replace(/\s+/g,'\s'); //.replace(/\n/, '\s');
			} catch(error){
				console.log(`\nFailure to get organization-name for url: ${request.url}: \n`, error);
			}
			if (company_name) {
				// section
				var summary_text='';
				try {
					var summary_element = await page.$('section.facts'); // section.facts > dl > dd:nth-child(1) 
					var summary_text = await (await summary_element.getProperty('textContent')).jsonValue();
					//console.log('section.facts: ', summary_text);
				} catch(error){
					console.log(`\nFailure to get summary text for url: ${request.url}: `, error);
				}
				var contact_text='';
				try {
					var contact_element = await page.$('div#contact-info');
					var contact_text = await (await contact_element.getProperty('textContent')).jsonValue();
					//console.log('contact info: ', contact_text);
				} catch(error){
					console.log(`\nFailure to get summary text for url: ${request.url}: `, error);
				}
	// 			await page.evaluate(name_element => name_element.textContent, name_element);
				console.log(`Company for ${request.url}: ${name_text}`);			 
			 
				await dataset.pushData({ 
					url: request.url,
					name: company_name,
					summary : summary_text,
					contact : contact_text
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
	
	//console.log('\nDeleting requestQueue');
	//await requestQueue.delete();
	
	console.log('\n******** Results ********');
	var obj = { companies: [] };	 
	await dataset.forEach(async (item, index) => {		
	    if (item.name) { 
			obj.companies.push(item);
			console.log(`${index}. "${item.name}" ${item.url}`); 
			//if (item.summary ) { console.log(item.summary ); }
			//if (item.contact ) { console.log(item.contact ); }
		}
	});
	const data = await dataset.getData().then((response) => response.items);
	Apify.setValue('OUTPUT', data);
	
	//var json = ;
	//console.log('obj length:', obj.companies.lenght());
    try { 
		fs.writeFile('companies-jsonfile.json',  JSON.stringify(obj) , 'utf8', (err) => {
			if (err) { 
				console.log('Json file save error:', err); 
			} else { 	   
				console.log('Json file is saved!'); 
			}
		}); 
	} catch(e) {
		console.log(`\nFailure write into json file.\n`, e);
	}
	const { itemCount } = await dataset.getInfo();
	console.log('******************\nTotal items in dataset: ', itemCount);
});