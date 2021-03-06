"use strict";
/*
 * Copyright 2010-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var S2Manager_1 = require("../s2/S2Manager");
var DynamoDBManager = (function () {
    function DynamoDBManager(config) {
        this.config = config;
    }
    /**
     * Query Amazon DynamoDB
     *
     * @param queryInput
     * @param hashKey
     *            Hash key for the query request.
     *
     * @param range
     *            The range of geohashs to query.
     *
     * @return The query result.
     */
    DynamoDBManager.prototype.queryGeohash = function (queryInput, hashKey, range) {
        var _this = this;
        var queryOutputs = [];
        var nextQuery = function (lastEvaluatedKey) {
            if (lastEvaluatedKey === void 0) { lastEvaluatedKey = null; }
            var keyConditions = {};
            keyConditions[_this.config.hashKeyAttributeName] = {
                ComparisonOperator: "EQ",
                AttributeValueList: [{ N: hashKey.toString(10) }]
            };
            var minRange = { N: range.rangeMin.toString(10) };
            var maxRange = { N: range.rangeMax.toString(10) };
            keyConditions[_this.config.geohashAttributeName] = {
                ComparisonOperator: "BETWEEN",
                AttributeValueList: [minRange, maxRange]
            };
            var defaults = {
                TableName: _this.config.tableName,
                KeyConditions: keyConditions,
                IndexName: _this.config.geohashIndexName,
                ConsistentRead: _this.config.consistentRead,
                ReturnConsumedCapacity: "TOTAL",
                ExclusiveStartKey: lastEvaluatedKey
            };
            return _this.config.dynamoDBClient.query(__assign({}, defaults, queryInput)).promise()
                .then(function (queryOutput) {
                queryOutputs.push(queryOutput);
                if (queryOutput.LastEvaluatedKey) {
                    return nextQuery(queryOutput.LastEvaluatedKey);
                }
            });
        };
        return nextQuery().then(function () { return queryOutputs; });
    };
    DynamoDBManager.prototype.getPoint = function (getPointInput) {
        var geohash = S2Manager_1.S2Manager.generateGeohash(getPointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        var getItemInput = getPointInput.GetItemInput;
        getItemInput.TableName = this.config.tableName;
        getItemInput.Key = (_a = {},
            _a[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) },
            _a[this.config.rangeKeyAttributeName] = getPointInput.RangeKeyValue,
            _a);
        return this.config.dynamoDBClient.getItem(getItemInput);
        var _a;
    };
    DynamoDBManager.prototype.putPoint = function (putPointInput, callback) {
        var geohash = S2Manager_1.S2Manager.generateGeohash(putPointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        var putItemInput = putPointInput.PutItemInput;
        putItemInput.TableName = this.config.tableName;
        if (!putItemInput.Item) {
            putItemInput.Item = {};
        }
        putItemInput.Item[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
        putItemInput.Item[this.config.rangeKeyAttributeName] = putPointInput.RangeKeyValue;
        putItemInput.Item[this.config.geohashAttributeName] = { N: geohash.toString(10) };
        putItemInput.Item[this.config.geoJsonAttributeName] = {
            S: JSON.stringify({
                type: 'POINT',
                coordinates: (this.config.longitudeFirst ?
                    [putPointInput.GeoPoint.longitude, putPointInput.GeoPoint.latitude] :
                    [putPointInput.GeoPoint.latitude, putPointInput.GeoPoint.longitude])
            })
        };
        return this.config.dynamoDBClient.putItem(putItemInput, callback);
    };
    DynamoDBManager.prototype.batchWritePoints = function (putPointInputs) {
        var _this = this;
        var writeInputs = [];
        putPointInputs.forEach(function (putPointInput) {
            var geohash = S2Manager_1.S2Manager.generateGeohash(putPointInput.GeoPoint);
            var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, _this.config.hashKeyLength);
            var putItemInput = putPointInput.PutItemInput;
            if (!putItemInput.Item) {
                putItemInput.Item = {};
            }
            putItemInput.Item[_this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
            putItemInput.Item[_this.config.rangeKeyAttributeName] = putPointInput.RangeKeyValue;
            putItemInput.Item[_this.config.geohashAttributeName] = { N: geohash.toString(10) };
            putItemInput.Item[_this.config.geoJsonAttributeName] = {
                S: JSON.stringify({
                    type: 'POINT',
                    coordinates: (_this.config.longitudeFirst ?
                        [putPointInput.GeoPoint.longitude, putPointInput.GeoPoint.latitude] :
                        [putPointInput.GeoPoint.latitude, putPointInput.GeoPoint.longitude])
                })
            };
            writeInputs.push({ PutRequest: putItemInput });
        });
        return this.config.dynamoDBClient.batchWriteItem({
            RequestItems: (_a = {},
                _a[this.config.tableName] = writeInputs,
                _a)
        });
        var _a;
    };
    DynamoDBManager.prototype.updatePoint = function (updatePointInput) {
        var geohash = S2Manager_1.S2Manager.generateGeohash(updatePointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        updatePointInput.UpdateItemInput.TableName = this.config.tableName;
        if (!updatePointInput.UpdateItemInput.Key) {
            updatePointInput.UpdateItemInput.Key = {};
        }
        updatePointInput.UpdateItemInput.Key[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
        updatePointInput.UpdateItemInput.Key[this.config.rangeKeyAttributeName] = updatePointInput.RangeKeyValue;
        // Geohash and geoJson cannot be updated.
        if (updatePointInput.UpdateItemInput.AttributeUpdates) {
            delete updatePointInput.UpdateItemInput.AttributeUpdates[this.config.geohashAttributeName];
            delete updatePointInput.UpdateItemInput.AttributeUpdates[this.config.geoJsonAttributeName];
        }
        return this.config.dynamoDBClient.updateItem(updatePointInput.UpdateItemInput);
    };
    DynamoDBManager.prototype.deletePoint = function (deletePointInput) {
        var geohash = S2Manager_1.S2Manager.generateGeohash(deletePointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        deletePointInput.DeleteItemInput.TableName = this.config.tableName;
        if (!deletePointInput.DeleteItemInput.Key) {
            deletePointInput.DeleteItemInput.Key = {};
        }
        deletePointInput.DeleteItemInput.Key[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
        deletePointInput.DeleteItemInput.Key[this.config.rangeKeyAttributeName] = deletePointInput.RangeKeyValue;
        return this.config.dynamoDBClient.deleteItem(deletePointInput.DeleteItemInput);
    };
    return DynamoDBManager;
}());
exports.DynamoDBManager = DynamoDBManager;
