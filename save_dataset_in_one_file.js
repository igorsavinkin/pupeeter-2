const Apify = require('apify'); 
// default name of dataset and filename 
var dataset_name= 'AT-CH-5K-10K';
var file_name = 'OUTPUT-AT-CH-5K-10K-2';
process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
  if (index==2) { dataset_name = val  }
  if (index==3) { file_name = val   }
  /*if (val.startsWith('country=')) {
	  countries = val.split('country=')[1]; 
  }*/
});
var failed_items = new Set();

Apify.main(async () => {  	
	try {
		const dataset = await Apify.openDataset(dataset_name);
		const { itemCount } = await dataset.getInfo();
		if (itemCount) {
			console.log('itemCount:', itemCount);
			const data = await dataset.getData({ 'bom':true }).then((response) => response.items); 			
			// get failed/not full items
			await dataset.forEach(async (item, index) => {
			    console.log(`Item at ${index}: ${JSON.stringify(item)}`);
				if (item.website.toLowerCase() == 'homepage' || item.employees_num==''){
					failed_items.add(item.url);
				}				
			});
			
			await Apify.setValue(file_name, data);
			await Apify.setValue(file_name+'_failed_items', failed_items);
			console.log(`\n${itemCount} items from dataset "${dataset_name}" are saved in "${file_name}" file.`);
			console.log(`${failed_items.size} failed items from dataset "${dataset_name}" are saved in "${file_name}_failed_items" file.`);
		} else {
			console.log(`Empty dataset "${dataset_name}".`);
		}		
		
	} catch(e) {
		console.log(`Failure to save dataset "${dataset_name}" as "${file_name}" file.`);
		console.log('Error:', e); 
		}
});
console.log(failed_items);