"use strict";

const { Wallets } = require("fabric-network");
const FabricCAServices = require("fabric-ca-client");
const fs = require("fs");
const path = require("path");

async function registerUser(userType) {
  try {
    const ccpPath = path.resolve(
      __dirname,
      "../..",
      "test-network",
      "organizations",
      "peerOrganizations",
      "org1.example.com",
      "connection-org1.json"
    );
    const ccp = JSON.parse(fs.readFileSync(ccpPath, "utf8"));

    const caInfo = ccp.certificateAuthorities["ca.org1.example.com"];
    const caTLSCACerts = caInfo.tlsCACerts && caInfo.tlsCACerts.pem;
    if (!caTLSCACerts || (Array.isArray(caTLSCACerts) && caTLSCACerts.length === 0)) {
      throw new Error(
        "CA TLS trust certificate is missing from the connection profile. " +
        "Regenerate the connection profile and verify its CA certificate before provisioning identities."
      );
    }

    // Use the trust root generated into the connection profile and verify the CA server.
    const ca = new FabricCAServices(
      caInfo.url,
      { trustedRoots: caTLSCACerts, verify: true },
      caInfo.caName
    );

    const walletPath = path.join(process.cwd(), "wallet");
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userIdentity = await wallet.get(userType);
    if (userIdentity) {
      console.log(
        `An identity for the user "${userType}" already exists in the wallet`
      );
      return;
    }

    const adminIdentity = await wallet.get("admin");
    if (!adminIdentity) {
      console.log(
        'An identity for the admin user "admin" does not exist in the wallet'
      );
      console.log("Run the enrollAdmin.js application before retrying");
      return;
    }

    // build a user object for authenticating with the CA
    const provider = wallet
      .getProviderRegistry()
      .getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, "admin");

    const secret = await ca.register(
      {
        affiliation: "org1.department1",
        enrollmentID: userType,
        role: "client",
      },
      adminUser
    );
    const enrollment = await ca.enroll({
      enrollmentID: userType,
      enrollmentSecret: secret,
    });
    const x509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes(),
      },
      mspId: "Org1MSP",
      type: "X.509",
    };
    await wallet.put(userType, x509Identity);
    console.log(
      `Successfully registered and enrolled user "${userType}" and imported it into the wallet`
    );
  } catch (error) {
    console.error(`Failed to register user "${userType}": ${error}`);
    process.exit(1);
  }
}

exports.registerUser = registerUser;
