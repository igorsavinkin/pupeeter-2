const Apify = require('apify'); 
process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";

Apify.main(async () => {  	
	try {
		const dataset = await Apify.openDataset('scraped-info');
		const data = await dataset.getData().then((response) => response.items); 
		const file_name = 'OUTPUT';
		await Apify.setValue(file_name, data);
		const { itemCount } = await dataset.getInfo();
		console.log(`${itemCount} items are saved in ${file_name}.`);
	} catch(e) {
		console.log('Failure to save dataset as ${file_name}.');
		console.log('Error:', e); 
		}
});