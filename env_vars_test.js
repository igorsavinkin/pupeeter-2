const Apify = require('apify');
const puppeteer = require('puppeteer'); 
process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";
process.env.APIFY_MEMORY_MBYTES = 2000;

Apify.main(async () => { 
	const  enviroment_vars  = await Apify.getEnv();
	console.log('enviroment vars :', enviroment_vars);
});