/* Author: Kevin Gorski 
*/

$(function() {
	$('.tabs')
		.tabs()
		.bind('change', 
			function(e) { 
				if(e.target.hash === '#Projections') {
					calculateTransactions();
				}
			});

	var accounts = [],
		assets = [],
		liabilities = [],
		cashFlows = [],
		
		$accountsList = $('#AccountsList'),
		$assetsList = $('#AssetsList'),
		$liabilitiesList = $('#LiabilitiesList'),
		$cashFlowsList = $('#CashFlowList'),
		$projectionList = $('#ProjectionList'),
		
		$accountSelects = $('#CashFlowFromAccount, #CashFlowToAccount'),
		$liabilitySelects = $('#CashFlowToLiability'),
		$assetSelects = $('#CashFlowAsset');
	
	
	if(window.localStorage['Accounts']) {
		accounts = JSON.parse(window.localStorage['Accounts']);
	}
	
	if(window.localStorage['Assets']) {
		assets = JSON.parse(window.localStorage['Assets']);
	}
	
	if(window.localStorage['Liabilities']) {
		liabilities = JSON.parse(window.localStorage['Liabilities']);
	}
	
	if(window.localStorage['CashFlows']) {
		cashFlows = JSON.parse(window.localStorage['CashFlows']);
	}
	
	
	var generateGUID = function() {
			// http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
			// Not really a GUID, but random and good enough
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			    return v.toString(16);
			});
		},
		calculateTransactions = function() {
			var startDate = new Date(),
				// Last day of the month
				endDate = moment(new Date(startDate)).add('M', 1).date(1).subtract('d', 1).native(),
				months = [],
				month = {
					start: startDate,
					end: endDate,
					accounts: {},
					liabilities: {}
				};

			// Clone accounts & liabilities into a hash 
			$.each(accounts, function() { month.accounts[this.id] = { name: this.name, balance: this.balance }; });
			// Here we negate the value of liabilities for display
			$.each(liabilities, function() { month.liabilities[this.id] = { name: this.name, value: -this.value }; });

			// First calculate current totals (liabilities already negative)
			month.total = 
				accounts.reduce(function(prev, curr) { return prev + curr.balance; }, 0) 
				+ liabilities.reduce(function(prev, curr) { return prev + curr.value; }, 0);

			months.push(month);
			
			var createTransaction = function(cashflow, date) {
				var transaction = {
					title: cashflow.name,
					date: date,
					lineItems: {}
				}

				if(cashflow.fromAccountId) {
					transaction.lineItems[cashflow.fromAccountId] = {
						name: month.accounts[cashflow.fromAccountId].name,
						value: -cashflow.amount
					};
				}
				
				if(cashflow.toAccountId) {
					transaction.lineItems[cashflow.toAccountId] = {
						name: month.accounts[cashflow.toAccountId].name,
						value: cashflow.amount
					};
				}
				
				if(cashflow.toLiabilityId) {
					transaction.lineItems[cashflow.toLiabilityId] = {
						name: month.liabilities[cashflow.toLiabilityId].name,
						value: cashflow.amount
					};
				}
				
				return transaction;
			};

			// Calculate any transactions for the rest of the month
			// For each cash flow, create +/- for accounts, liabilities
			// Calculate account/liability totals at end of the month
			var leftToProject = 4;
			
			while(leftToProject > 0) {
				month = {
					start: startDate,
					end: endDate,
					transactions: []
				};
				
				// Clone last month's accounts & liabilities (hashes, not arrays)
				month.accounts = $.extend(true, {}, months[months.length - 1].accounts);
				month.liabilities = $.extend(true, {}, months[months.length - 1].liabilities);
				
				// Calculate any transactions month-by-month
				$.each(cashFlows, function() {
					switch(this.period) {
						case 'Weekly':
							// One transaction for every Sunday left in the month
							var weeklyMoment = moment(new Date(startDate)),
								offset = 7 - weeklyMoment.day();

							weeklyMoment.add('d', offset);

							while(startDate.getMonth() === weeklyMoment.month()) {
								month.transactions.push(createTransaction(this, new Date(weeklyMoment.native())));

								weeklyMoment.add('w', 1);
							}
							break;
						case 'Twice a month':
							if(startDate.getDate() === 1) {
								month.transactions.push(createTransaction(this, startDate));
							}

							if(startDate.getDate() <= 15) {
								var secondDate = new Date(startDate);

								secondDate.setDate(15);

								month.transactions.push(createTransaction(this, secondDate));
							}
							break;
						case 'Monthly':	
							if(startDate.getDate() === 1) {
								month.transactions.push(createTransaction(this, startDate));
							}
							break;
						case 'Yearly':
							if(startDate.getMonth() === 0 && startDate.getDate() === 1) {
								month.transactions.push(createTransaction(this, startDate));
							}
							break;
					}
				});
				
				// Update running account/liability balances
				$.each(month.transactions, function() {
					$.each(this.lineItems, function(id, li) {
						if(month.accounts[id]) {
							month.accounts[id].balance += li.value;
						} else if(month.liabilities[id]) {
							month.liabilities[id].value += li.value;
						}
					});
				});

				// Calculate account/liability totals at end of each month
				month.total = 0;
				
				$.each(month.accounts, function() { month.total += this.balance; });
				$.each(month.liabilities, function() { month.total -= this.value; });
				
				months.push(month);
				
				// Move start/end date
				startDate = moment(endDate).add('d', 1).native();
				endDate = moment(new Date(startDate)).add('M', 1).subtract('d', 1).native(),
				leftToProject--;
			}
			
			// Remove the baseline
			months.shift();
			
			// Display projections
			var html = '';
			
			$.each(months, function(i, e) {
				html += tim('<h2>{{title}}</h2>', 
					{ title: moment(e.start).format('MMMM, YYYY') });
				
				html += '<table class="bordered-table zebra-striped transactions">' +
					'<thead><tr><th>Transaction</th>';
				
				$.each(accounts, function(i, e){ html += tim('<th>{{name}}</th>', e); });
				$.each(liabilities, function(i, e){ html += tim('<th>{{name}}</th>', e); });
				
				html += '</tr></thead>';


				// Ending balances
				html += '<tfoot><tr><th>Ending Balance</th>';
				
				$.each(e.accounts, function() { html += tim('<td>{{balance}}</td>', this); });
				$.each(e.liabilities, function() { html += tim('<td>{{value}}</td>', this); });

				html += '</tr></tfoot>';


				// Transactions
				html += '<tbody>';
				
				$.each(month.transactions, function(i, e) {
					html += tim('<tr><th>{{title}}</th>', e);

					// TODO: check all lineItems each time
					$.each(accounts, function(ai, a){ 
						html += (e.lineItems[a.id]) ? tim('<td>{{value}}</td>', e.lineItems[a.id]) : '<td>0</td>';
					});
					
					$.each(liabilities, function(li, l) {
						html += (e.lineItems[l.id]) ? tim('<td>{{value}}</td>', e.lineItems[l.id]) : '<td>0</td>';
					});
				});
				
				html += '</tbody>';
				html += '</table>';
			});
			
			$projectionList.html(html);
		};
	
	
	// Welcome form
	$('#Welcome form').submit(function() {
		window.localStorage['DisplayName'] = $('#DisplayName').val();
		
		return false;
	});
	
	
	// Accounts form
	var $accountForm = $('#Accounts form'),
		$accountNameField = $('#AccountName'),
		$accountBalanceField = $('#AccountBalance'),
		$accountNotesField = $('#AccountNotes'),
		$accountIdField = $('#AccountId');
	
	var bindAccounts = function() {
		var html;

		if(accounts.length) {
			html = '<table class="bordered-table zebra-striped">' +
				'<thead><tr><th>Account Name</th><th>Balance</th><th></th></tr></thead>' +
				'<tbody>' + 
					$.map(accounts, function(e){ 
						return tim('<tr data-id="{{id}}"><td>{{name}}</td><td class="currency">${{balance}}</td><td>' +
							'<button class="btn">Edit</button>&nbsp;<button class="btn danger">Delete</button></td></tr>', e);
					}).join('') +
				'</tbody></table>';
		} else {
			html = '<p>You don\'t have any accounts yet.</p>';
		}

		$accountsList.html(html);
		
		$accountSelects.html(
			'<option value="">(None)</option>' + 
			$.map(accounts, function(e) { 
				return tim('<option value="{{id}}">{{name}}</option>', e);
			}).join(''));

		window.localStorage['Accounts'] = JSON.stringify(accounts);
	};
	
	$accountForm.submit(function() {
		var tempId = $accountIdField.val(),
			account = 
			{
				id: tempId.length ? tempId : generateGUID(),
				name: $accountNameField.val(),
				balance: parseFloat($accountBalanceField.val()),
				notes: $accountNotesField.val()
			};
		
		this.reset();
		$accountIdField.val('');
		
		if(tempId) {
			var inDex;
			$.each(accounts, function(i, e) { if(e.id === tempId) { index = i; return false; } })
			accounts.splice(index, 1, account);
		} else {
			accounts.push(account);
		}
		
		bindAccounts();
		
		return false;
	});
	
	$('#Accounts table button').live('click', function() {
		var rowId = $(this).parents('tr').data('id');
		switch($(this).text()) {
			case 'Edit':
				var account = $.grep(accounts, function(e){ return e.id === rowId; })[0];
				
				$accountIdField.val(rowId);
				$accountNameField.val(account.name);
				$accountBalanceField.val(account.balance);
				$accountNotesField.val(account.notes);
				
				break;
			case 'Delete':
				var index;
				$.each(accounts, function(i, e) { if(e.id === rowId) { index = i; return false; } })
				accounts.splice(index, 1);
				
				var tempId = $accountIdField.val();
				
				if(tempId == rowId) {
					$accountForm[0].reset();
					$accountIdField.val('');
				}
				
				bindAccounts();
				break;
		}
	});
	
	
	// Assets
	var $assetsForm = $('#Assets form'),
		$assetNameField = $('#AssetName'),
		$assetValueField = $('#AssetValue'),
		$assetNotesField = $('#AssetNotes'),
		$assetIdField = $('#AssetId');
	
	var bindAssets = function() {
		var html;

		if(assets.length) {
			html = '<table class="bordered-table zebra-striped">' +
				'<thead><tr><th>Asset Name</th><th>Value</th><th></th></tr></thead>' +
				'<tbody>' + 
					$.map(assets, function(e){ 
						return tim('<tr data-id="{{id}}"><td>{{name}}</td><td class="currency">${{value}}</td><td>' +
							'<button class="btn">Edit</button>&nbsp;<button class="btn danger">Delete</button></td></tr>', e);
					}).join('') +
				'</tbody></table>';
		} else {
			html = '<p>You don\'t have any assets yet.</p>';
		}

		$assetsList.html(html);
		
		$assetSelects.html('<option value="">(None)</option>' +
			$.map(assets, function(e) { return tim('<option value="{{id}}">{{name}}</option>', e); }).join(''));

		window.localStorage['Assets'] = JSON.stringify(assets);
	};
	
	$assetsForm.submit(function() {
		var tempId = $assetIdField.val(),
			asset = 
			{
				id: tempId.length ? tempId : generateGUID(),
				name: $assetNameField.val(),
				value: parseFloat($assetValueField.val()),
				notes: $assetNotesField.val()
			};
		
		this.reset();
		$assetIdField.val('');
		
		if(tempId) {
			var index;
			$.each(assets, function(i, e) { if(e.id === tempId) { index = i; return false; } })
			assets.splice(index, 1, asset);
		} else {
			assets.push(asset);
		}
		
		bindAssets();
		
		return false;
	});
	
	$('#Assets table button').live('click', function() {
		var rowId = $(this).parents('tr').data('id');
		switch($(this).text()) {
			case 'Edit':
				var asset = $.grep(assets, function(e){ return e.id === rowId; })[0];
				
				$assetIdField.val(rowId);
				$assetNameField.val(asset.name);
				$assetValueField.val(asset.value);
				$assetNotesField.val(asset.notes);
				
				break;
			case 'Delete':
				var index;
				$.each(assets, function(i, e) { if(e.id === rowId) { index = i; return false; } })
				assets.splice(index, 1);
				
				var tempId = $assetIdField.val();
				
				if(tempId && tempId === rowId) {
					$assetsForm[0].reset();
					$assetIdField.val('');
				}
				
				bindAssets();
				break;
		}
	});
	
	
	// Liabilities
	var $liabilitiesForm = $('#Liabilities form'),
		$liabilityNameField = $('#LiabilityName'),
		$liabilityValueField = $('#LiabilityValue'),
		$liabilityNotesField = $('#LiabilityNotes'),
		$liabilityIdField = $('#LiabilityId');
	
	var bindLiabilities = function() {
		var html;

		if(liabilities.length) {
			html = '<table class="bordered-table zebra-striped">' +
				'<thead><tr><th>Liability Name</th><th>Value</th><th></th></tr></thead>' +
				'<tbody>' + 
					$.map(liabilities, function(e){ 
						return tim('<tr data-id="{{id}}"><td>{{name}}</td><td class="currency">${{value}}</td><td>' +
							'<button class="btn">Edit</button>&nbsp;<button class="btn danger">Delete</button></td></tr>', e);
					}).join('') +
				'</tbody></table>';
		} else {
			html = '<p>You don\'t have any liabilities yet.</p>';
		}

		$liabilitiesList.html(html);
		
		$liabilitySelects.html(
			'<option value="">(None)</option>' +
			$.map(liabilities, function(e) { return tim('<option value="{{id}}">{{name}}</option>', e); }).join(''));

		window.localStorage['Liabilities'] = JSON.stringify(liabilities);
	};
	
	$liabilitiesForm.submit(function() {
		var tempId = $liabilityIdField.val(),
			liability = 
			{
				id: tempId.length ? tempId : generateGUID(),
				name: $liabilityNameField.val(),
				value: parseFloat($liabilityValueField.val()),
				notes: $liabilityNotesField.val()
			};
		
		this.reset();
		$liabilityIdField.val('');
		
		if(tempId) {
			var index;
			$.each(liabilities, function(i, e) { if(e.id === tempId) { index = i; return false; } })
			liabilities.splice(index, 1, liability);
		} else {
			liabilities.push(liability);
		}
		
		bindLiabilities();
		
		return false;
	});
	
	$('#Liabilities table button').live('click', function() {
		var rowId = $(this).parents('tr').data('id');
		switch($(this).text()) {
			case 'Edit':
				var liability = $.grep(liabilities, function(e) { return e.id == rowId; })[0];
				
				$liabilityIdField.val(rowId);
				$liabilityNameField.val(liability.name);
				$liabilityValueField.val(liability.value);
				$liabilityNotesField.val(liability.notes);
				
				break;
			case 'Delete':
				var index;
				$.each(liabilities, function(i, e) { if(e.id === tempId) { index = i; return false; } })
				liabilities.splice(index, 1);
				
				var tempId = $liabilityIdField.val();
				
				if(tempId && tempId == rowId) {
					$liabilitiesForm[0].reset();
					$liabilityIdField.val('');
				} 
				
				bindLiabilities();
				break;
		}
	});
	
	
	// Cash Flow
	var $cashFlowForm = $('#CashFlow form'),
		$cashFlowIdField = $('#CashFlowId'),
		$cashFlowNameField = $('#CashFlowName'),
		$cashFlowAmountField = $('#CashFlowAmount'),
		$cashFlowPeriodField = $('#CashFlowPeriod'),
		$cashFlowFromAccountField = $('#CashFlowFromAccount'),
		$cashFlowToAccountField = $('#CashFlowToAccount'),
		$cashFlowToLiabilityField = $('#CashFlowToLiability'),
		$cashFlowAssetField = $('#CashFlowAsset');
	
	var bindCashFlows = function() {
		var html;

		if(cashFlows.length) {
			html = '<table class="bordered-table zebra-striped">' +
				'<thead><tr><th>Cash Flow Name</th><th>Amount</th><th>Period</th><th></th></tr></thead>' +
				'<tbody>' + 
					$.map(cashFlows, function(e){ 
						return tim('<tr data-id="{{id}}"><td>{{name}}</td><td class="currency">${{amount}}</td><td>{{period}}</td><td>' +
							'<button class="btn">Edit</button>&nbsp;<button class="btn danger">Delete</button></td></tr>', e);
					}).join('') +
				'</tbody></table>';
		} else {
			html = '<p>You don\'t have any cash flows yet.</p>';
		}

		$cashFlowsList.html(html);
		
		window.localStorage['CashFlows'] = JSON.stringify(cashFlows);
	};
	
	$cashFlowForm.submit(function() {
		var tempId = $cashFlowIdField.val(),
			cashFlow = 
			{
				id: tempId.length ? tempId : generateGUID(),
				name: $cashFlowNameField.val(),
				amount: parseFloat($cashFlowAmountField.val()),
				period: $cashFlowPeriodField.val(),
				fromAccountId: $cashFlowFromAccountField.val(),
				toAccountId: $cashFlowToAccountField.val(),
				toLiabilityId: $cashFlowToLiabilityField.val(),
				assetId: $cashFlowAssetField.val()
			};
		
		this.reset();
		$cashFlowIdField.val('');
		
		if(tempId) {
			var index;
			$.each(cashFlows, function(i, e) { if(e.id === tempId) { index = i; return false; } })
			cashFlows.splice(index, 1, cashFlow);
		} else {
			cashFlows.push(cashFlow);
		}
		
		bindCashFlows();
		
		return false;
	});
	
	$('#CashFlow table button').live('click', function() {
		var rowId = $(this).parents('tr').data('id');
		switch($(this).text()) {
			case 'Edit':
				var cashFlow = $.grep(cashFlows, function(e) { return e.id === rowId; })[0];
				
				$cashFlowIdField.val(rowId);
				$cashFlowNameField.val(cashFlow.name);
				$cashFlowAmountField.val(cashFlow.amount);
				$cashFlowPeriodField.val(cashFlow.period);
				$cashFlowFromAccountField.val(cashFlow.fromAccountId);
				$cashFlowToAccountField.val(cashFlow.toAccountId);
				$cashFlowToLiabilityField.val(cashFlow.toLiabilityId);
				$cashFlowAssetField.val(cashFlow.assetId);
				
				break;
			case 'Delete':
				var index;
				$.each(cashFlows, function(i, e) { if(e.id === tempId) { index = i; return false; } })
				cashFlows.splice(index, 1);
				
				var tempId = $cashFlowIdField.val();
				
				if(tempId && tempId == rowId) {
					$cashFlowForm[0].reset();
					$cashFlowIdField.val('');
				}
				
				bindCashFlows();
				break;
		}
	});
	
	
	// Initialize the DOM
	$('#DisplayName').val(window.localStorage['DisplayName']);
	bindAccounts();
	bindAssets();
	bindLiabilities();
	bindCashFlows();
});