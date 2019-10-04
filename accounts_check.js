require('./login-xing.js');
async function check_non_active_accounts(accounts){	
	let deactivated = new Set();
	//console.log('\nStart deactivated accounts check');
	for(let i in accounts) {
		//console.log('\n' + i +'.',  accounts[i].username );
		let result_page, login_check;		
		result_page = await login(accounts[i].username, accounts[i].password);
		if ( (typeof result_page) == 'string') { 
			//console.log('Result page:',result_page );
			if (result_page.includes('deactivated')) {				
				deactivated.add(parseInt(i));
			}
		} else { // result_page is a page Object of pupeeter
			//console.log('Result page:', result_page.url());
			login_check = await check_if_logged_in(result_page);
			console.log('login result:', login_check);
			if (result_page.url().includes('deactivated') || !login_check) {
				deactivated.add(parseInt(i));
			}
		}		
	}
	console.log('deactivated set:', deactivated);
	return deactivated;
}
global.check_non_active_accounts=check_non_active_accounts;