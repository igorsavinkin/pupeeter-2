const Apify = require('apify');
const puppeteer = require('puppeteer'); 
//process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";
//process.env.APIFY_MEMORY_MBYTES = 2000;

Apify.main(async () => { 
	const  enviroment_vars  = await Apify.getEnv();
	console.log('localStorageDir:', enviroment_vars.localStorageDir );
	console.log('memoryMbytes:', enviroment_vars.memoryMbytes );
	
	try { 
		//const input = await Apify.getInput(); // https://sdk.apify.com/docs/api/apify#module_Apify.getInput
		const store = await Apify.openKeyValueStore();
		const input = await store.getValue('INPUT');
		console.log('\ninput:', input );
	} catch(e) { 
		console.log('Error in the input configuration for the actor:', e); 
	} 
});