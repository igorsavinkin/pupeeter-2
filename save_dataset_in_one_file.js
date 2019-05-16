const Apify = require('apify'); 
process.env.APIFY_LOCAL_STORAGE_DIR="./apify_storage";
var dataset_name= 'scraped-info';
Apify.main(async () => {  	
	try {
		const dataset = await Apify.openDataset(dataset_name);
		const { itemCount } = await dataset.getInfo();
		if (itemCount) {
			const data = await dataset.getData().then((response) => response.items); 
			const file_name = 'OUTPUT';
			await Apify.setValue(file_name, data);
			console.log(`${itemCount} items from dataset ${dataset_name} are saved in ${file_name}.`);
		} else {
			console.log(`Empty dataset "${dataset_name}".`);
		}		
		
	} catch(e) {
		console.log('Failure to save dataset ${dataset_name} as ${file_name}.');
		console.log('Error:', e); 
		}
});