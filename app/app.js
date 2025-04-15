import express from "express";

import { getTiers } from "./state.js";

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";

function checkRequiredFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      return `Missing field: ${key}`;
    }
  }

  return null;
}

function validatePositiveIntegerFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (!Number.isInteger(value) || value <= 0) {
      return `Invalid ${key}. Must be a positive integer.`;
    }
  }

  return null;
}

function validatePositiveNumberFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "number" || value <= 0) {
      return `Invalid ${key}. Must be a positive number.`;
    }
  }
  return null;
}

function evaluateFields(fromAccountId, toAccountId, amount) {
  const missingFieldError = checkRequiredFields({ fromAccountId, toAccountId, amount });
  if (missingFieldError) {
    return missingFieldError;
  }

  const invalidAccountsIdError = validatePositiveIntegerFields({ fromAccountId, toAccountId });
  if (invalidAccountsIdError) {
    return invalidAccountsIdError;
  }

  const invalidAmountError = validatePositiveNumberFields({ amount });
  if (invalidAmountError) {
    return invalidAmountError;
  }

  return null;
}

function validateAccountsHaveSameCurrency(firstAccount, secondAccounts) {
  if (firstAccount.currency !== secondAccounts.currency) {
    return "Accounts must have the same currency";
  }

  return null;
}

function validateFundsFromAccount(fromAccount, amount) {
  if (fromAccount.balance < amount) {
    return "Insufficient funds in source account.";
  }

  return null;
}

function evaluateAccountsAndAmount(fromAccount, toAccount, amount) {
  if (!fromAccount || !toAccount) {
    return "One or both accounts not found.";
  }

  const invalidAccountsIdError = validateAccountsHaveSameCurrency(fromAccount, toAccount);
  if (invalidAccountsIdError) {
    return "Accounts must have the same currency";
  }

  const invalidAmountError = validateFundsFromAccount(fromAccount, amount);
  if (invalidAmountError) {
    return "Insufficient funds in source account.";
  }
}

await exchangeInit();

const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoint
app.get("/accounts", (_, res) => {
  res.json(getAccounts());
});

// TIERS endpoint
app.get("/tiers", (_, res) => {
  res.json(getTiers());
});

// TRANSFER endpoint
app.post("/transfer", (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body;

  const fieldError = evaluateFields(fromAccountId, toAccountId, amount);
  if (fieldError) {
    return res.status(400).json({ error: fieldError });
  }

  const accounts = getAccounts();
  const fromAccount = accounts.find(acc => acc.id === fromAccountId);
  const toAccount = accounts.find(acc => acc.id === toAccountId);

  const accountsAndAmountError = evaluateAccountsAndAmount(fromAccount, toAccount, amount);
  if (accountsAndAmountError) {
    return res.status(400).json({ error: accountsAndAmountError });
  }

  setAccountBalance(fromAccountId, fromAccount.balance - amount);
  setAccountBalance(toAccountId, toAccount.balance + amount);

  res.status(200).json({
    message: "Transfer completed successfully",
    fromAccountId,
    toAccountId,
    amount
  });
});

// RATE endpoints
app.get("/rates", (_, res) => {
  res.json(getRates());
});

app.put("/rates", (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (baseCurrency === undefined) {
    return res.status(400).json({ error: "Missing field: baseCurrency" });
  }

  if (counterCurrency === undefined) {
    return res.status(400).json({ error: "Missing field: counterCurrency" });
  }

  if (rate === undefined) {
    return res.status(400).json({ error: "Missing field: rate" });
  }

  if (typeof baseCurrency !== "string" || baseCurrency.length !== 3) {
    return res.status(400).json({
      error: "Invalid baseCurrency: must be a 3-character string"
    });
  }

  if (typeof counterCurrency !== "string" || counterCurrency.length !== 3) {
    return res.status(400).json({
      error: "Invalid counterCurrency: must be a 3-character string"
    });
  }

  if (!Number.isInteger(rate) || rate <= 0) {
    return res.status(400).json({
      error: "Invalid rate: must be an integer greater than 0"
    });
  }

  const newRateRequest = { ...req.body };
  setRate(newRateRequest);

  res.json(getRates());
});

// LOG endpoint
app.get("/log", (_, res) => {
  res.json(getLog());
});

// EXCHANGE endpoint
app.post("/exchange", async (req, res) => {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = req.body;

  if (baseCurrency === undefined) {
    return res.status(400).json({ error: "Missing field: baseCurrency" });
  }

  if (counterCurrency === undefined) {
    return res.status(400).json({ error: "Missing field: counterCurrency" });
  }

  if (baseAccountId === undefined) {
    return res.status(400).json({ error: "Missing field: baseAccountId" });
  }

  if (counterAccountId === undefined) {
    return res.status(400).json({ error: "Missing field: counterAccountId" });
  }

  if (baseAmount === undefined) {
    return res.status(400).json({ error: "Missing field: baseAmount" });
  }

  if (typeof baseCurrency !== "string" || baseCurrency.length !== 3) {
    return res.status(400).json({
      error: "Invalid baseCurrency: must be a 3-character string"
    });
  }

  if (typeof counterCurrency !== "string" || counterCurrency.length !== 3) {
    return res.status(400).json({ 
      error: "Invalid counterCurrency must be a 3-character string" 
    });
  }

  if (!Number.isInteger(baseAccountId) || baseAccountId <= 0) {
    return res.status(400).json({ error: "baseAccountId must be a positive integer" });
  }

  if (!Number.isInteger(counterAccountId) || counterAccountId <= 0) {
    return res.status(400).json({ error: "counterAccountId must be a positive integer" });
  }

  if (typeof baseAmount !== "number" || baseAmount <= 0) {
    return res.status(400).json({ error: "baseAmount must be a positive number" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  if (exchangeResult.ok) {
    res.status(200).json('Currency exchange completed.');
  } else {
    res.status(500).json('An error occurred while processing the exchange.');
  }
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
