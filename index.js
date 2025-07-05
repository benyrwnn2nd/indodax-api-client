const axios = require('axios');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

const API_URL = 'https://indodax.com/tapi';
const API_KEY = 'your-api-key-here'; // Replace with your Indodax API key
const SECRET_KEY = 'your-secret-key-here'; // Replace with your Indodax secret key

async function callIndodaxAPI(method, params = {}) {
  try {
    const timestamp = Date.now();
    const payload = {
      method,
      timestamp,
      recvWindow: 5000,
      ...params,
    };
    const queryString = new URLSearchParams(payload).toString();
    const signature = crypto
      .createHmac('sha512', SECRET_KEY)
      .update(queryString)
      .digest('hex');

    const response = await axios.post(API_URL, queryString, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Key: API_KEY,
        Sign: signature,
      },
    });

    if (response.data.success) {
      return response.data.return;
    } else {
      throw new Error(response.data.error || 'Failed to call API');
    }
  } catch (error) {
    throw new Error(`Indodax API Error: ${error.message}`);
  }
}

async function getInfo() {
  function formatIDR(num) {
    if (typeof num === "string") num = parseFloat(num);
    if (isNaN(num)) return "-";
    return num.toLocaleString("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
  }
  function maskEmail(email) {
    if (!email) return "-";
    const [name, domain] = email.split("@");
    let maskedName = name.length <= 2 
      ? name[0] + "*".repeat(Math.max(0, name.length - 1)) 
      : name.slice(0, 2) + "*".repeat(name.length - 2);
    const [domainName, ...domainExt] = domain.split(".");
    let maskedDomain = domainName[0] + "*".repeat(Math.max(0, domainName.length - 2)) + domainName.slice(-1);
    return maskedName + "@" + maskedDomain + "." + domainExt.join(".");
  }
  try {
    const data = await callIndodaxAPI('getInfo');
    let caption = `Account Status - ${new Date(data.server_time * 1000).toLocaleString('id-ID')}\n\n`;
    caption += `Name: ${data.name || 'Not available'}\n`;
    caption += `Email: ${maskEmail(data.email)}\n`;
    caption += `User ID: ${data.user_id}\n`;
    caption += `Verification Status: ${data.verification_status}\n`;
    caption += `2FA: ${data.gauth_enable ? 'Active' : 'Inactive'}\n`;
    caption += `Withdrawal: ${data.withdraw_status ? 'Active' : 'Inactive'}\n\n`;

    caption += `Active Balance\n`;
    const activeBalances = Object.entries(data.balance).filter(([_, amount]) => parseFloat(amount) > 0);
    if (activeBalances.length > 0) {
      activeBalances.forEach(([asset, amount]) => {
        if (asset.toLowerCase() === 'idr') {
          caption += `${asset.toUpperCase()}: ${formatIDR(amount)}\n`;
        } else {
          caption += `${asset.toUpperCase()}: ${parseFloat(amount).toFixed(8)}\n`;
        }
      });
    } else {
      caption += `No active balance.\n`;
    }
    caption += `\nHeld Balance\n`;
    const heldBalances = Object.entries(data.balance_hold).filter(([_, amount]) => parseFloat(amount) > 0);
    if (heldBalances.length > 0) {
      heldBalances.forEach(([asset, amount]) => {
        if (asset.toLowerCase() === 'idr') {
          caption += `${asset.toUpperCase()}: ${formatIDR(amount)}\n`;
        } else {
          caption += `${asset.toUpperCase()}: ${parseFloat(amount).toFixed(8)}\n`;
        }
      });
    } else {
      caption += `No held balance.\n`;
    }

    return caption;
  } catch (error) {
    return `Failed to Retrieve Account Data\n${error.message}`;
  }
}

async function transHistory(startDate, endDate) {
  try {
    const data = await callIndodaxAPI('transHistory', {
      start: startDate,
      end: endDate,
    });

    let caption = `Indodax Transaction History\n`;
    caption += `Period: ${startDate} to ${endDate}\n\n`;

    caption += `Withdrawal History\n`;
    for (const [currency, transactions] of Object.entries(data.withdraw)) {
      if (transactions.length > 0) {
        caption += `${currency.toUpperCase()}:\n`;
        transactions.forEach((tx) => {
          caption += `Status: ${tx.status}\n`;
          caption += `Type: ${tx.type}\n`;
          caption += `Total Amount: ${tx.rp || tx[currency] || '0'} ${currency.toUpperCase()}\n`;
          caption += `Fee: ${tx.fee || '0'} ${currency.toUpperCase()}\n`;
          caption += `Net Amount: ${tx.amount || '0'} ${currency.toUpperCase()}\n`;
          caption += `Submission Time: ${new Date(tx.submit_time * 1000).toLocaleString('id-ID')}\n`;
          caption += `Completion Time: ${new Date(tx.success_time * 1000).toLocaleString('id-ID')}\n`;
          caption += `Withdrawal ID: ${tx.withdraw_id}\n`;
          caption += `Transaction ID: ${tx.tx}\n\n`;
        });
      }
    }
    if (Object.values(data.withdraw).every(arr => arr.length === 0)) {
      caption += `No withdrawal history.\n\n`;
    }

    caption += `Deposit History\n`;
    for (const [currency, transactions] of Object.entries(data.deposit)) {
      if (transactions.length > 0) {
        caption += `${currency.toUpperCase()}:\n`;
        transactions.forEach((tx) => {
          caption += `Status: ${tx.status}\n`;
          caption += `Type: ${tx.type || 'Direct'}\n`;
          caption += `Total Amount: ${tx.rp || tx[currency] || '0'} ${currency.toUpperCase()}\n`;
          caption += `Fee: ${tx.fee || '0'} ${currency.toUpperCase()}\n`;
          caption += `Net Amount: ${tx.amount || '0'} ${currency.toUpperCase()}\n`;
          caption += `Completion Time: ${new Date(tx.success_time * 1000).toLocaleString('id-ID')}\n`;
          caption += `Deposit ID: ${tx.deposit_id}\n`;
          caption += `Transaction ID: ${tx.tx}\n\n`;
        });
      }
    }
    if (Object.values(data.deposit).every(arr => arr.length === 0)) {
      caption += `No deposit history.\n`;
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Transaction History\n${error.message}`;
  }
}

async function trade(pair, type, amount, price = null, orderType = 'limit', clientOrderId = null, timeInForce = 'GTC') {
  try {
    let params = {
      pair,
      type: type.toLowerCase(),
      order_type: orderType.toLowerCase(),
      client_order_id: clientOrderId || `client-${Date.now()}`,
      time_in_force: timeInForce.toUpperCase(),
    };

    if (orderType.toLowerCase() === 'limit') {
      params.price = parseFloat(price);
      if (type.toLowerCase() === 'buy') {
        params.idr = parseFloat(amount);
      } else {
        params[pair.split('_')[0]] = parseFloat(amount);
      }
    } else if (orderType.toLowerCase() === 'market') {
      params.idr = parseFloat(amount);
    }

    const data = await callIndodaxAPI('trade', params);

    let caption = `Trading Order Report\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Order Type: ${type.toUpperCase()} ${orderType.toUpperCase()}\n`;
    caption += `Pair: ${pair.toUpperCase()}\n`;
    if (orderType.toLowerCase() === 'limit') {
      caption += `Price: ${parseFloat(price).toFixed(2)} ${pair.split('_')[1].toUpperCase()}\n`;
    }
    caption += `Amount: ${parseFloat(amount).toFixed(8)} ${type.toLowerCase() === 'buy' ? pair.split('_')[1].toUpperCase() : pair.split('_')[0].toUpperCase()}\n`;
    caption += `Order ID: ${data.order_id}\n`;
    caption += `Client ID: ${data.client_order_id}\n`;
    caption += `Fee: ${parseFloat(data.fee).toFixed(8)} ${pair.split('_')[1].toUpperCase()}\n`;
    caption += `Received: ${parseFloat(data.receive_btc || 0).toFixed(8)} ${pair.split('_')[0].toUpperCase()}\n`;
    caption += `Spent: ${parseFloat(data.spend_rp || 0).toFixed(2)} ${pair.split('_')[1].toUpperCase()}\n`;
    caption += `Remaining: ${parseFloat(data.remain_rp || 0).toFixed(2)} ${pair.split('_')[1].toUpperCase()}\n`;

    return caption;
  } catch (error) {
    return `Failed to Place Trading Order\n${error.message}`;
  }
}

async function tradeHistory(pair, count = 1000, fromId = null, endId = null, order = 'desc', since = null, end = null, orderId = null) {
  try {
    const params = {
      pair,
      count: parseInt(count),
      from_id: fromId,
      end_id: endId,
      order: order.toLowerCase(),
      since: since ? Math.floor(new Date(since).getTime() / 1000) : null,
      end: end ? Math.floor(new Date(end).getTime() / 1000) : null,
      order_id: orderId,
    };
    Object.keys(params).forEach(key => params[key] === null && delete params[key]);
    const data = await callIndodaxAPI('tradeHistory', params);

    let caption = `Indodax Trading History\n`;
    caption += `Updated At: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Total Transactions: ${data.trades.length}\n`;
    caption += `Pair: ${pair.toUpperCase()}\n`;
    if (since || end) {
      caption += `Period: ${since ? new Date(since).toLocaleDateString('id-ID') : 'Start'} to ${end ? new Date(end).toLocaleDateString('id-ID') : 'Now'}\n`;
    }
    caption += `Order: ${order.toUpperCase()}\n\n`;

    if (data.trades.length === 0) {
      caption += `No trading history.\n`;
    } else {
      data.trades.forEach((trade, index) => {
        caption += `Transaction ${index + 1}\n`;
        caption += `Transaction ID: ${trade.trade_id}\n`;
        caption += `Order ID: ${trade.order_id}\n`;
        caption += `Type: ${trade.type.toUpperCase()}\n`;
        caption += `Amount: ${parseFloat(trade.btc).toFixed(8)} ${ Pair.split('_')[0].toUpperCase()}\n`;
        caption += `Price: ${parseFloat(trade.price).toFixed(2)} ${pair.split('_')[1].toUpperCase()}\n`;
        caption += `Fee: ${parseFloat(trade.fee).toFixed(8)} ${pair.split('_')[1].toUpperCase()}\n`;
        caption += `Time: ${new Date(trade.trade_time * 1000).toLocaleString('id-ID')}\n`;
        caption += `Client ID: ${trade.client_order_id || 'Not available'}\n\n`;
      });
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Trading History\n${error.message}`;
  }
}

async function openOrders(pair = null) {
  try {
    const params = { pair };
    if (!pair) delete params.pair;

    const data = await callIndodaxAPI('openOrders', params);

    let caption = `Indodax Open Orders\n`;
    caption += `Updated At: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Total Orders: ${Object.keys(data).length}\n\n`;

    if (Object.keys(data).length === 0) {
      caption += `No open orders.\n`;
    } else {
      for (const [p, orders] of Object.entries(data)) {
        caption += `Pair: ${p.toUpperCase()}\n`;
        caption += `Total Orders: ${orders.length}\n`;
        orders.forEach((order, index) => {
          caption += `Order ${index + 1}\n`;
          caption += `Order ID: ${order.order_id}\n`;
          caption += `Client ID: ${order.client_order_id}\n`;
          caption += `Submission Time: ${new Date(order.submit_time * 1000).toLocaleString('id-ID')}\n`;
          caption += `Type: ${order.type.toUpperCase()}\n`;
          caption += `Price: ${parseFloat(order.price || order.order_idr || 0).toFixed(2)} ${p.split('_')[1].toUpperCase()}\n`;
          caption += `Order Amount: ${parseFloat(order.order_btc || 0).toFixed(8)} ${p.split('_')[0].toUpperCase()}\n`;
          caption += `Remaining: ${parseFloat(order.remain_btc || order.remain_idr || 0).toFixed(8)} ${order.remain_btc ? p.split('_')[0].toUpperCase() : p.split('_')[1].toUpperCase()}\n`;
          if (order.order_type) {
            caption += `Order Type: ${order.order_type.toUpperCase()}\n`;
          }
          caption += `\n`;
        });
      }
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Open Orders\n${error.message}`;
  }
}

async function orderHistory(pair, count = 1000, from = null) {
  try {
    const params = { pair, count: parseInt(count), from };
    Object.keys(params).forEach(key => params[key] === null && delete params[key]);
    const data = await callIndodaxAPI('orderHistory', params);

    let caption = `Indodax Order History\n`;
    caption += `Updated At: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Total Orders: ${data.orders.length}\n`;
    caption += `Pair: ${pair.toUpperCase()}\n`;
    caption += `Displayed Count: ${count}\n\n`;

    if (data.orders.length === 0) {
      caption += `No order history.\n`;
    } else {
      data.orders.forEach((order, index) => {
        caption += `Order ${index + 1}\n`;
        caption += `Order ID: ${order.order_id}\n`;
        caption += `Client ID: ${order.client_order_id}\n`;
        caption += `Type: ${order.type.toUpperCase()}\n`;
        caption += `Price: ${parseFloat(order.price).toFixed(2)} ${pair.split('_')[1].toUpperCase()}\n`;
        caption += `Submission Time: ${new Date(order.submit_time * 1000).toLocaleString('id-ID')}\n`;
        caption += `Completion Time: ${order.finish_time ? new Date(order.finish_time * 1000).toLocaleString('id-ID') : 'Not completed'}\n`;
        caption += `Status: ${order.status}\n`;
        caption += `Order Amount: ${parseFloat(order.order_idr || order.order_btc || 0).toFixed(8)} ${order.order_idr ? pair.split('_')[1].toUpperCase() : pair.split('_')[0].toUpperCase()}\n`;
        caption += `Remaining: ${parseFloat(order.remain_idr || order.remain_btc || 0).toFixed(8)} ${order.remain_idr ? pair.split('_')[1].toUpperCase() : pair.split('_')[0].toUpperCase()}\n`;
        caption += `\n`;
      });
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Order History\n${error.message}`;
  }
}

async function getOrder(pair, orderId) {
  try {
    const params = {
      pair,
      order_id: parseInt(orderId),
    };

    const data = await callIndodaxAPI('getOrder', params);

    let caption = `Indodax Order Details\n`;
    caption += `Updated At: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Order ID: ${data.order.order_id}\n`;
    caption += `Pair: ${pair.toUpperCase()}\n`;
    caption += `Type: ${data.order.type.toUpperCase()}\n`;
    caption += `Price: ${parseFloat(data.order.price).toFixed(2)} ${pair.split('_')[1].toUpperCase()}\n`;
    caption += `Submission Time: ${new Date(data.order.submit_time * 1000).toLocaleString('id-ID')}\n`;
    caption += `Completion Time: ${data.order.finish_time ? new Date(data.order.finish_time * 1000).toLocaleString('id-ID') : 'Not completed'}\n`;
    caption += `Status: ${data.order.status}\n`;
    caption += `Order Amount: ${parseFloat(data.order.order_rp || 0).toFixed(8)} ${pair.split('_')[1].toUpperCase()}\n`;
    caption += `Remaining: ${parseFloat(data.order.remain_rp || 0).toFixed(8)} ${pair.split('_')[1].toUpperCase()}\n`;
    if (data.order.refund_idr) {
      caption += `Refund Amount: ${parseFloat(data.order.refund_idr).toFixed(8)} ${pair.split('_')[1].toUpperCase()}\n`;
    }
    caption += `Client ID: ${data.order.client_order_id}\n`;

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Order Details\n${error.message}`;
  }
}

async function cancelOrder(pair, orderId, type, orderType = 'limit') {
  try {
    const params = {
      pair,
      order_id: parseInt(orderId),
      type: type.toLowerCase(),
      order_type: orderType.toLowerCase(),
    };

    const data = await callIndodaxAPI('cancelOrder', params);

    let caption = `Indodax Order Cancellation Report\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Pair: ${pair.toUpperCase()}\n`;
    caption += `/Order ID: ${data.order.order_id}\n`;
    caption += `Type: ${data.order.type.toUpperCase()}\n`;
    caption += `Order Type: ${data.order.order_type.toUpperCase()}\n`;
    caption += `BTC Balance: ${parseFloat(data.balance.btc).toFixed(8)} BTC\n`;
    caption += `IDR Balance: ${parseFloat(data.balance.idr).toFixed(2)} IDR\n`;
    caption += `Frozen BTC Balance: ${parseFloat(data.frozen.btc).toFixed(8)} BTC\n`;
    caption += `Frozen IDR Balance: ${parseFloat(data.frozen.idr).toFixed(2)} IDR\n`;
    caption += `Client ID: ${data.order.client_order_id}\n`;

    return caption.trim();
  } catch (error) {
    return `Failed to Cancel Order\n${error.message}`;
  }
}

async function withdrawFee(currency, network = null) {
  try {
    const params = {
      currency: currency.toLowerCase(),
      network,
    };
    Object.keys(params).forEach(key => params[key] === null && delete params[key]);
    const data = await callIndodaxAPI('withdrawFee', params);

    let caption = `Indodax Withdrawal Fee\n`;
    caption += `Time: ${new Date(data.server_time * 1000).toLocaleString('id-ID')}\n`;
    caption += `Currency: ${data.currency.toUpperCase()}\n`;
    if (network) {
      caption += `Network: ${network.toUpperCase()}\n`;
    }
    caption += `Withdrawal Fee: ${parseFloat(data.withdraw_fee).toFixed(8)} ${data.currency.toUpperCase()}\n`;

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Withdrawal Fee\n${error.message}`;
  }
}

async function withdrawCoin(currency, network, withdrawAddress, withdrawAmount, requestId, withdrawMemo = null) {
  try {
    const params = {
      method: 'withdrawCoin',
      currency: currency.toLowerCase(),
      network: network.toLowerCase(),
      withdraw_address: withdrawAddress,
      withdraw_amount: parseFloat(withdrawAmount),
      request_id: requestId,
      withdraw_memo: withdrawMemo,
    };
    Object.keys(params).forEach(key => params[key] === null && delete params[key]);
    const data = await callIndodaxAPI('withdrawCoin', params);

    let caption = `Indodax Asset Withdrawal Report\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Currency: ${data.withdraw_currency.toUpperCase()}\n`;
    caption += `Network: ${network.toUpperCase()}\n`;
    caption += `Recipient Address: ${data.withdraw_address}\n`;
    caption += `Amount: ${parseFloat(data.withdraw_amount).toFixed(8)} ${data.withdraw_currency.toUpperCase()}\n`;
    caption += `Fee: ${parseFloat(data.fee).toFixed(8)} ${data.withdraw_currency.toUpperCase()}\n`;
    caption += `Submission Time: ${new Date(data.submit_time * 1000).toLocaleString('id-ID')}\n`;
    caption += `Request ID: ${data.request_id}\n`;
    if (withdrawMemo) {
      caption += `Memo: ${withdrawMemo}\n`;
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Process Withdrawal\n${error.message}`;
  }
}

async function withdrawCoinByUsername(currency, withdrawAmount, requestId, withdrawUsername, withdrawMemo = null) {
  try {
    const params = {
      method: 'withdrawCoin',
      currency: currency.toLowerCase(),
      withdraw_amount: parseFloat(withdrawAmount),
      request_id: requestId,
      withdraw_input_method: 'username',
      withdraw_username: withdrawUsername,
      withdraw_memo: withdrawMemo,
    };
    Object.keys(params).forEach(key => params[key] === null && delete params[key]);
    const data = await callIndodaxAPI('withdrawCoin', params);

    let caption = `Indodax Withdrawal to Username Report\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Currency: ${data.withdraw_currency.toUpperCase()}\n`;
    caption += `Recipient Username: ${data.withdraw_username}\n`;
    caption += `Amount: ${parseFloat(data.withdraw_amount).toFixed(8)} ${data.withdraw_currency.toUpperCase()}\n`;
    caption += `Fee: ${parseFloat(data.fee).toFixed(8)} ${data.withdraw_currency.toUpperCase()}\n`;
    caption += `Submission Time: ${new Date(data.submit_time * 1000).toLocaleString('id-ID')}\n`;
    caption += `Request ID: ${data.request_id}\n`;
    if (withdrawMemo) {
      caption += `Memo: ${withdrawMemo}\n`;
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Process Withdrawal to Username\n${error.message}`;
  }
}

async function listDownline(page = 1, limit = 10) {
  try {
    const params = {
      method: 'listDownline',
      page: parseInt(page),
      limit: parseInt(limit),
    };
    const data = await callIndodaxAPI('listDownline', params);

    let caption = `Indodax Downline List\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Page: ${data.current_page}\n`;
    caption += `Total Pages: ${data.total_page}\n`;
    caption += `Total Data: ${data.total_data}\n`;
    caption += `Data per Page: ${data.data_per_page}\n`;
    caption += `Downline Count: ${data.data.length}\n\n`;

    if (data.data.length === 0) {
      caption += `No downlines.\n`;
    } else {
      data.data.forEach((downline, index) => {
        caption += `Downline ${index + 1}\n`;
        caption += `Username: ${downline.username}\n`;
        caption += `Email: ${downline.email}\n`;
        caption += `Email Verification: ${downline.email_verified ? 'Yes' : 'No'} (${new Date(downline.registration_date * 1000).toLocaleString('id-ID')})\n`;
        caption += `Identity Verification: ${downline.id_verified ? 'Yes' : 'No'}\n`;
        caption += `Start: ${downline.start || 'N/A'}\n`;
        caption += `End: ${downline.end || 'N/A'}\n\n`;
      });
    }

    return caption.trim();
  } catch (error) {
    return `Failed to Retrieve Downline List\n${error.message}`;
  }
}

async function checkDownline(email) {
  try {
    const params = {
      method: 'checkDownline',
      email: email,
    };
    const data = await callIndodaxAPI('checkDownline', params);

    let caption = `Indodax Downline Check\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Email: ${email}\n`;
    caption += `Downline Status: ${data.is_downline ? 'Yes (Email is in your downline)' : 'No (Email is not in your downline)'}\n`;

    return caption.trim();
  } catch (error) {
    return `Failed to Check Downline\n${error.message}`;
  }
}

async function createVoucher(amount, toEmail) {
  try {
    const params = {
      method: 'createVoucher',
      amount: parseInt(amount),
      to_email: toEmail,
    };
    const data = await callIndodaxAPI('createVoucher', params);

    let caption = `Indodax Voucher Creation Report\n`;
    caption += `Time: ${new Date().toLocaleString('id-ID')}\n`;
    caption += `Voucher Amount: ${data.amount} IDR\n`;
    caption += `Recipient Email: ${data.to_email}\n`;
    caption += `Voucher Code: ${data.voucher}\n`;
    caption += `Creation Time: ${new Date(data.submit_time * 1000).toLocaleString('id-ID')}\n`;

    return caption.trim();
  } catch (error) {
    return `Failed to Create Voucher\n${error.message}`;
  }
}

module.exports = {
  getInfo,
  transHistory,
  trade,
  tradeHistory,
  openOrders,
  orderHistory,
  getOrder,
  cancelOrder,
  withdrawFee,
  withdrawCoin,
  withdrawCoinByUsername,
  listDownline,
  checkDownline,
  createVoucher
};
