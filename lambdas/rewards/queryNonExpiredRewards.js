const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const REWARDS_TABLE = process.env.REWARDS_TABLE;
const clientConfig = {
	region: "us-east-1",
};
if (process.env.IS_OFFLINE) {
	clientConfig.region = "localhost";
	clientConfig.endpoint = "http://localhost:8000";
}
const client = new DynamoDBClient(clientConfig);
async function query(params) {
	try {
		const res = await client.send(new QueryCommand(params));
		return res;
	} catch (error) {
		return error;
	}
}
module.exports.queryNonExpiredRewards = async function (event) {
	if (!event.pathParameters.phoneNumber) {
		return {
			statusCode: 400,
			message: "Missing required path parameter, phoneNumber",
		};
	}
	const queryValue = event.pathParameters.phoneNumber;
	const date = new Date();
	const sortKeyValue = date.setHours(0, 0, 0, 0);
	const params = {
		TableName: REWARDS_TABLE,
		IndexName: "NonExpiredRewardsIndex",
		KeyConditionExpression: "phoneNumber=:hkey AND expiresAt < :skey",
		ExpressionAttributeValues: {
			":hkey": { S: queryValue },
			":skey": { N: sortKeyValue },
		},
	};
	try {
		const result = await query(params);
		return {
			statusCode: 200,
			body: JSON.stringify(result),
		};
	} catch (error) {
		return { error: error.message };
	}
};
