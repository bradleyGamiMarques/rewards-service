const {
	DynamoDBClient,
	GetItemCommand,
	PutItemCommand,
} = require("@aws-sdk/client-dynamodb");
const REWARDS_TABLE = process.env.REWARDS_TABLE;
const clientConfig = {
	region: "us-east-1",
};
if (process.env.IS_OFFLINE) {
	clientConfig.region = "localhost";
	clientConfig.endpoint = "http://localhost:8000";
}
const client = new DynamoDBClient(clientConfig);

async function getRewardExpiresAt(params) {
	try {
		const item = await client.send(new GetItemCommand(params));
		return item;
	} catch (error) {
		return error;
	}
}
async function create(params) {
	try {
		await client.send(new PutItemCommand(params));
	} catch (error) {
		return error;
	}
}

module.exports.createReward = async function (event) {
	// TODO1 Validate that the user is logged in.
	// TODO1 Validate that the data from the request body matches a schema before parsing.
	/* Making the assumption that a client with an accountId is creating a reward
	using this endpoint. They submit their accountId, when the reward expiresAt,
	the customer's phoneNumber, and reward.*/
	const { accountId, expiresAt, phoneNumber, reward } = JSON.parse(
		event.body
	);
	// TODO1 Validate that the phoneNumber from the body matches the phoneNumber for the logged in user.

	const createdAt = new Date().getTime();
	// Set a date object to the last midnight of the current timezone
	// where the lambda is running.
	const date = new Date();
	const today = date.setHours(0, 0, 0, 0);
	// Get the reward with the matching accountId and expiresAt
	const getRewardExpiresAtParams = {
		TableName: REWARDS_TABLE,
		Key: {
			accountId: { S: `${accountId}` },
			expiresAt: { N: `${expiresAt}` },
		},
		ProjectionExpression: "expiresAt",
	};

	// Create the params for the UpdateItemCommand.
	const params = {
		TableName: REWARDS_TABLE,
		Item: {
			accountId,
			phoneNumber,
			reward,
			createdAt,
			expiresAt,
			updatedAt: createdAt,
		},
	};
	// Not sure how to test this :(
	const itemToUpdate = await getRewardExpiresAt(getRewardExpiresAtParams);
	if (itemToUpdate.Item) {
		// PUT a new record in if the expiresAt field is less than the timestamp.
		// This has the effect of allowing multiple records with the same accountId
		// and phoneNumber.
		params.ConditionExpression = ":expiresAt < :today";
		params.ExpressionAttributeValues = {
			":expiresAt": { N: `${itemToUpdate.Item.expiresAt}` },
			":today": { N: `${today}` },
		};
	}
	try {
		await create(params);
		return {
			statusCode: 200,
			body: JSON.stringify(params.Item),
		};
	} catch (error) {
		return { error: error.message };
	}
};
