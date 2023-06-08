const express = require('express');
const app = express();

// Route for handling the callback request
app.get('/oauth/callback', (req, res) => {
  const authorizationCode = req.query.code;
  
  // Process the authorization code as needed
  // You can save it, exchange it for an access token, etc.
  
  // Example: Send a response back to the user
  res.send('Authorization code received: ' + authorizationCode);
});

// Start the server
app.listen(4000, () => {
  console.log('Server started on port 4000');
});