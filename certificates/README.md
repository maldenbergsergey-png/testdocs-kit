# Additional CA certificates

Use these public CA certificates only when a server does not send a complete TLS chain and Node.js reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Pass a PEM file to the installer:

```bash
npm run setup -- --ca-file /absolute/path/to/ca-bundle.pem
```

The installer stores only the absolute path. The MCP launcher passes it to Node.js through `NODE_EXTRA_CA_CERTS`. TLS verification remains enabled.

## GlobalSign GCC R3 DV TLS CA 2020

File: `globalsign-gcc-r3-dv-tls-ca-2020.pem`

- Source: `http://secure.globalsign.com/cacert/gsgccr3dvtlsca2020.crt`
- Subject: `C=BE, O=GlobalSign nv-sa, CN=GlobalSign GCC R3 DV TLS CA 2020`
- Issuer: `OU=GlobalSign Root CA - R3, O=GlobalSign, CN=GlobalSign`
- Valid until: 2029-03-18
- SHA-256: `76:25:38:43:95:09:C4:11:C4:37:D3:C5:67:56:3E:13:78:67:12:81:FC:4A:14:64:AD:D0:31:87:08:43:67:6E`

The long-term fix is to configure the target server to send its full certificate chain.
