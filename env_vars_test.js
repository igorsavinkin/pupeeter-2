const Apify = require('apify');
const puppeteer = require('puppeteer'); 
//process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";
//process.env.APIFY_MEMORY_MBYTES = 2000;

Apify.main(async () => { 
	const  enviroment_vars  = await Apify.getEnv();
	console.log('\n localStorageDir:', enviroment_vars.localStorageDir );
	console.log(' memoryMbytes:', enviroment_vars.memoryMbytes );
	 	
	try {		
		const input = await Apify.getInput();
		console.log('\n input:', input );  
	} catch(e) { 
		console.log('Error in the input :', e); 
	} 
});