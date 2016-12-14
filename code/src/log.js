var fs = require('fs');

/**
 *@param {String} fileName: full path and name of the file
 */
function Log(fileName, idNode) {
    if (!(this instanceof Log))
        return new Log(fileName);
    
    this._fileName = fileName;
    this._results = {};
    this._results['id'] = idNode;
    initialize(this);
}

function initialize(self) {
    self._nbServerTransferredTriples = 0;
    self._nbServerCalls = 0;
    self._nbLocalCalls = 0;
    self._client = {'shuffle': 
		      {'sent': 0, 
		       'received': 0}, 
		    'askDelegate': 
		      {'sent': 0, 
		       'received': 0}, 
		    'execute': 
		      {'sent': 0, 
		       'received': 0},
		    'total':
		      {'sent': 0,
		       'received': 0}
		   };
    self._server = {'shuffle': 
		      {'sent': 0, 
		       'received': 0}, 
		    'askDelegate': 
		      {'sent': 0, 
		       'received': 0}, 
		    'execute': 
		      {'sent': 0, 
		       'received': 0},
		    'total':
		      {'sent': 0,
		       'received': 0}
		   };

    self._statSelfWorkload = {'local': 0, 'delegate': 0, 'timeout': 0, 'tryDelegate': 0};
    self._stateNode = {'local': 0, 'delegate': 0, 'timeout': 0};
    self._nbQueries = 0;
}

Log.prototype.incrementTryDelegate = function() {
    this._statSelfWorkload.tryDelegate++;
}

Log.prototype.getNbQueries = function() {
    return this._nbQueries;
}

Log.prototype.incrementNbQueries = function() {
    this._nbQueries++;
}

Log.prototype.incrementStateNodeLocal = function() {
    this._stateNode.local++;
}

Log.prototype.incrementStateNodeDelegate = function() {
    this._stateNode.delegate++;
}

Log.prototype.incrementStateNodeTimeout = function() {
    this._stateNode.timeout++;
}

Log.prototype.incrementSelfWorkloadLocal = function() {
    this._statSelfWorkload.local++;
}

Log.prototype.incrementSelfWorkloadDelegate = function() {
    this._statSelfWorkload.delegate++;
}

Log.prototype.incrementSelfWorkloadTimeout = function() {
    this._statSelfWorkload.timeout++;
}

Log.prototype.incrementClientNbShufSent = function() {
    this._client.shuffle.sent++;
    this._client.total.sent++;
}

Log.prototype.incrementClientNbShufReceived = function() {
    this._client.shuffle.received++;
    this._client.total.received++;
}

Log.prototype.incrementClientNbAskSent = function() {
    this._client.askDelegate.sent++;
    this._client.total.sent++;
}

Log.prototype.incrementClientNbAskReceived = function() {
    this._client.askDelegate.received++;
    this._client.total.received++;
}

Log.prototype.incrementClientNbExecuteSent = function() {
    this._client.execute.sent++;
    this._client.total.sent++;
}

Log.prototype.incrementClientNbExecuteReceived = function() {
    this._client.execute.received++;
    this._client.total.received++;
}

Log.prototype.incrementServerNbShufSent = function() {
    this._server.shuffle.sent++;
    this._server.total.sent++;
}

Log.prototype.incrementServerNbShufReceived = function() {
    this._server.shuffle.received++;
    this._server.total.received++;
}

Log.prototype.incrementServerNbAskSent = function() {
    this._server.askDelegate.sent++;
    this._server.total.sent++;
}

Log.prototype.incrementServerNbAskReceived = function() {
    this._server.askDelegate.received++;
    this._server.total.received++;
}

Log.prototype.incrementServerNbExecuteSent = function() {
    this._server.execute.sent++;
    this._server.total.sent++;
}

Log.prototype.incrementServerNbExecuteReceived = function() {
    this._server.execute.received++;
    this._server.total.received++;
}

Log.prototype.incrementNbLocalCalls = function() {
    this._nbLocalCalls++;
}

Log.prototype.incrementNbServerCalls = function() {
    this._nbServerCalls++;
}

Log.prototype.increaseServerTransferredTriples = function() {
    this._nbServerTransferredTriples++;
}

Log.prototype.writeRandomPeers = function (randomPeers) {
    var peers = [];
    randomPeers.forEach(function(peer) {
	peers.push(peer.id);
    });
    this._results['randomPeers'] = peers;
}

Log.prototype.writeClusterPeers = function (clusterPeers) {
    var peers = [];
    clusterPeers.forEach(function(peer) {
	peers.push(peer.id);
    });
    this._results['clusterPeers'] = peers;
}

// Shuffle on -> received, emit -> sent
// In client.js nbAskSent = emit('askDelegate'), nbExecuteSent = emit('execQuery')
// In server.js nbAskReceived = on('askDelegate'), nbExecuteReceive = on('execQuery')
/*Log.prototype.writeNbNeighborsCallClient = function (nbShufSent, nbShufReceived, nbAskSent, nbAskReceived, nbExecuteSent, nbExecuteReceived) {
    this._results['nbNeighborsCallClient'] = {shuffle: {sent: nbShufSent, received: nbShufReceived}, askDelegate: {sent: nbAskSent, received: nbAskReceived}, execute: {sent: nbExecuteSent, received: nbExecuteReceived}};
}

Log.prototype.writeNbNeighborsCallServer = function (nbShufSent, nbShufReceived, nbAskSent, nbAskReceived, nbExecuteSent, nbExecuteReceived) {
    this._results['nbNeighborsCallServer'] = {shuffle: {sent: nbShufSent, received: nbShufReceived}, askDelegate: {sent: nbAskSent, received: nbAskReceived}, execute: {sent: nbExecuteSent, received: nbExecuteReceived}};
}*/

/*Log.prototype.writeQueryDistribution = function (nbExecQuery, nbDelegateQuery, nbTimeoutQuery) {
    this._results['queryDistribution'] = {nbExecQuery: nbExecQuery, nbDelegateQuery: nbDelegateQuery, nbTimeoutQuery: nbTimeoutQuery};
}*/

Log.prototype.clearData = function() {
    initialize(this);
}

Log.prototype.saveResults = function(suffixe) {
    this._results['calls'] = {'local': this._nbLocalCalls, 'server': this._nbServerCalls, 'total': this._nbLocalCalls + this._nbServerCalls};
    this._results['messages'] = { 'client' : this._client, 'server': this._server, 'total': {'sent': this._client.total.sent + this._server.total.sent, 'received': this._client.total.received + this._server.total.received}};
    this._results['queries'] = {'client': this._statSelfWorkload, 'server': this._stateNode, 'total': {'local': this._statSelfWorkload.local + this._stateNode.local, 'delegate': this._statSelfWorkload.delegate + this._stateNode.delegate, 'timeout': this._statSelfWorkload.timeout + this._stateNode.timeout}};
    this._results['nbQueries'] = this._nbQueries;
    this._results['nbServerTransferredTriples'] = this._nbServerTransferredTriples;
    fs.writeFileSync(this._fileName + suffixe, JSON.stringify(this._results));
}

module.exports = Log;
