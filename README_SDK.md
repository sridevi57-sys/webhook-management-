# Webhook Signature Verification SDK Snippets

To secure your webhook endpoint, you must verify the HMAC-SHA256 signature included in the `X-Webhook-Signature` header of each incoming request. This ensures that the event was actually sent by our engine and has not been tampered with.

---

## 🟢 Node.js / TypeScript (Express)

Use the built-in `crypto` module to verify signatures:

```javascript
const crypto = require('crypto');

function verifyWebhook(reqBody, endpointSecret, headerSignature) {
  // 1. Calculate HMAC-SHA256 signature from raw stringified body
  const computedSignature = crypto
    .createHmac('sha256', endpointSecret)
    .update(typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody))
    .digest('hex');

  // 2. Perform a constant-time comparison to prevent timing attacks
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(computedSignature, 'hex'),
    Buffer.from(headerSignature, 'hex')
  );

  return isMatch;
}

// Example Express usage:
// NOTE: Make sure to capture the raw request body before parsing it as JSON!
app.post('/webhook-receiver', (req, res) => {
  const secret = 'whsec_your_endpoint_secret';
  const signature = req.headers['x-webhook-signature'];

  if (!signature) {
    return res.status(401).send('Signature missing');
  }

  const isValid = verifyWebhook(req.body, secret, signature);
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process verified payload
  console.log('Received event:', req.body);
  res.status(200).send('Verified');
});
```

---

## 🐍 Python (Flask)

Use Python's built-in `hmac` and `hashlib` libraries:

```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

def verify_webhook(payload_bytes, secret_key, header_signature):
    # 1. Compute HMAC SHA-256 signature from raw payload bytes
    computed = hmac.new(
        secret_key.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    # 2. Use a secure comparison function to prevent timing attacks
    return hmac.compare_digest(computed, header_signature)

@app.route('/webhook-receiver', methods=['POST'])
def webhook_receiver():
    secret = "whsec_your_endpoint_secret"
    signature = request.headers.get('X-Webhook-Signature')
    
    if not signature:
        return "Signature missing", 401
        
    # Get raw body bytes
    payload_bytes = request.get_data()
    
    is_valid = verify_webhook(payload_bytes, secret, signature)
    if not is_valid:
        return "Invalid signature", 401
        
    # Process verified payload
    event_data = request.get_json()
    print("Received event:", event_data)
    return "Verified", 200
```

---

## 🐹 Go (Golang)

Use Go's `crypto/hmac` and `crypto/sha256` packages:

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
)

func verifyWebhook(body []byte, secretKey string, headerSignature string) bool {
	// 1. Calculate computed signature
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write(body)
	computedSignature := hex.EncodeToString(mac.Sum(nil))

	// 2. Perform a constant-time comparison to prevent timing attacks
	return hmac.Equal([]byte(computedSignature), []byte(headerSignature))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	secret := "whsec_your_endpoint_secret"
	signature := r.Header.Get("X-Webhook-Signature")

	if signature == "" {
		http.Error(w, "Signature missing", http.StatusUnauthorized)
		return
	}

	// Read raw body bytes
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	isValid := verifyWebhook(bodyBytes, secret, signature)
	if !isValid {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	// Process verified payload
	fmt.Printf("Received event: %s\n", string(bodyBytes))
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Verified"))
}

func main() {
	http.HandleFunc("/webhook-receiver", webhookHandler)
	http.ListenAndServe(":8080", nil)
}
```
