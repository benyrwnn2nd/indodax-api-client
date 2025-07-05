# Indodax API Client

This Node.js script provides a client for interacting with the Indodax Private API, enabling users to manage their account, execute trades, retrieve transaction and order history, handle withdrawals, manage downlines, and create vouchers. The script uses HMAC-SHA512 authentication to securely communicate with the Indodax API (`https://indodax.com/tapi`) and formats responses in a human-readable format with Indonesian locale for dates and currency (IDR).

## Features

The script provides the following functions:

- **getInfo**: Retrieves account details, including name, masked email, user ID, verification status, 2FA status, withdrawal status, and active/held balances.
- **transHistory**: Fetches deposit and withdrawal transaction history for a specified date range.
- **trade**: Places a buy or sell order (limit or market) for a specified trading pair.
- **tradeHistory**: Retrieves trading history for a specified pair, with optional filters for count, time range, and order.
- **openOrders**: Lists open orders for a specific trading pair or all pairs.
- **orderHistory**: Retrieves order history for a specific trading pair, with optional count and starting point.
- **getOrder**: Fetches details of a specific order by its ID and trading pair.
- **cancelOrder**: Cancels an existing order by its ID, type, and trading pair.
- **withdrawFee**: Retrieves the withdrawal fee for a specified cryptocurrency and network.
- **withdrawCoin**: Initiates a cryptocurrency withdrawal to a specified address.
- **withdrawCoinByUsername**: Initiates a cryptocurrency withdrawal to another Indodax user by username.
- **listDownline**: Lists downline users with pagination (for referral programs).
- **checkDownline**: Checks if a specific email is in your downline.
- **createVoucher**: Creates a voucher for a specified amount and recipient email.

## Prerequisites

- **Node.js**: Version 14 or higher.
- **npm**: For installing dependencies.
- Valid Indodax API key and secret key (obtainable from your Indodax account settings).
- The `axios` package for making HTTP requests.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/benyrwnn2nd/indodax-api-client.git
   cd indodax-api-client

## Example Usage 

get indodax account information
```javascript
const { getInfo } = require('./index');

getInfo().then(result => {
  console.log(result);
}).catch(err => {
  console.error('Error:', err);
});
```

## Sample Output

Account Status - 5/7/2025, 11:57:00

Name: John Doe
Email: jo**@g***l.com
User ID: 123456
Verification Status: verified
2FA: Active
Withdrawal: Active

Active Balance
IDR: Rp1,000,000
BTC: 0.05000000

Held Balance
IDR: Rp0
BTC: 0.00000000
