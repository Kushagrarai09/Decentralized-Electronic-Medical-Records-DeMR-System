"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const EMRContract = require("../lib/emrcontract");

describe("EMRContract.getGrantedUserForEMR", function () {
  let contract;
  let ctx;

  beforeEach(function () {
    contract = new EMRContract();
    ctx = {
      stub: {
        createCompositeKey: sinon.stub().callsFake((objectType, attributes) =>
          [objectType, ...attributes].join(":")
        ),
        getState: sinon.stub(),
      },
    };
  });

  afterEach(function () {
    sinon.restore();
  });

  it("throws an error containing the requested email when the user does not exist", async function () {
    const emrID = "emr-123";
    const userEmail = "missing-user@example.com";
    const emr = {
      ID: emrID,
      recordOwner: "patient@example.com",
      recordAdder: "doctor@example.com",
      recordType: "medical",
      recordContent: "synthetic test record",
      recordCreationDate: "01/01/2026",
      permittedList: ["patient@example.com"],
    };

    ctx.stub.getState.callsFake(async (key) => {
      if (key === `EMR:${emrID}`) {
        return Buffer.from(JSON.stringify(emr));
      }

      if (key === `User:${userEmail}`) {
        return Buffer.alloc(0);
      }

      throw new Error(`Unexpected key requested: ${key}`);
    });

    try {
      await contract.getGrantedUserForEMR(ctx, emrID, userEmail);
      throw new Error("Expected getGrantedUserForEMR to reject for a nonexistent user");
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.equal(`User with ID: ${userEmail} doesn't exist`);
    }

    expect(ctx.stub.getState.calledTwice).to.equal(true);
  });
});
