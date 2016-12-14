/* Create two overlay one random overlay and one cluster overlay */
var ClusterTable = require('./clusterTable.js');
var RandomTable = require('./randomTable.js');

function neighborhoodTables (nbMaxRandomPeer, nbMaxClusterPeer, networkSimilarityMethod, hostId, nodeCache, profile) {
    this._randomPeers = new RandomTable(nbMaxRandomPeer, hostId);
    this._clusterPeers = new ClusterTable(nbMaxClusterPeer, networkSimilarityMethod, hostId, profile, this._randomPeers);
    this._hostId = hostId;
    this._nbMaxRandomPeer = nbMaxRandomPeer;
    this._nbMaxClusterPeer = nbMaxClusterPeer;
}

neighborhoodTables.prototype.getNbMaxRandomPeer = function() {
    return this._nbMaxRandomPeer;
}

neighborhoodTables.prototype.getNbMaxClusterPeer = function() {
    return this._nbMaxClusterPeer;
}

/*
 * @param {String} peerId: Id of the peer to whom we send the tables
 */
neighborhoodTables.prototype.sendNeigborhoodTables = function(peerId) {
    return {'randomPeers': this._randomPeers.halfRandomPeers(peerId), 'clusterPeers': this._clusterPeers.getPeers(peerId)};
}

neighborhoodTables.prototype.receiveNeigborhoodTables = function (peers) {
    var deletedRandomPeers = this._randomPeers.addPeers(peers.randomPeers);
    var deletedClusterPeers = this._clusterPeers.addPeers(peers.clusterPeers);
    var deletedPeers = deletedRandomPeers.concat(deletedClusterPeers);
    return this._excludePeerInTable(deletedPeers);
}

/*
 * Peers which were deleted in ClusterPeers can be present in RandomPeers and vice-versa
 */
neighborhoodTables.prototype._excludePeerInTable = function (deletedPeers) {
    var peersToDelete = [],
    randomPeers = this._randomPeers,
    clusterPeers = this._clusterPeers,
    tmpPeerId = [];
    deletedPeers.forEach(function(peer) {
	if (!(randomPeers.contain(peer.id) || clusterPeers.contain(peer.id)) && peer.id != this._hostId) {
	    console.log('NeighborhoodTable - test:', tmpPeerId.indexOf(peer.id) === -1);
	    if (tmpPeerId.indexOf(peer.id) === -1) {
		tmpPeerId.push(peer.id);
		peersToDelete.push(peer);
	    }
	}
    });
    return peersToDelete;
}

neighborhoodTables.prototype.RandomPeersFull = function() {
    return this._randomPeers.RandomPeersFull();
}

neighborhoodTables.prototype.addRandomPeer = function(peer) {
    this._randomPeers.addPeer(peer);
}


neighborhoodTables.prototype.oldestPeer = function() {
    if (this._randomPeers.size() > 0) {
        return this._randomPeers.oldestPeer();
    }
    return undefined;
}

neighborhoodTables.prototype.removePeer = function (peerId) {
    if (this._randomPeers.contain(peerId)) {this._randomPeers.remove(peerId);}
    if (this._clusterPeers.contain(peerId)) this._clusterPeers.remove(peerId);
}

neighborhoodTables.prototype.updateProfile = function(peerId, profile) {
    if (this._randomPeers.contain(peerId)) {this._randomPeers.setProfile(peerId, profile);}
    if (this._clusterPeers.contain(peerId)) {this._clusterPeers.setProfile(peerId, profile);}
}

neighborhoodTables.prototype.getClusterTable = function() {
    return this._clusterPeers;
}

neighborhoodTables.prototype.getClusterPeers = function() {
    return this._clusterPeers.getPeers();
}

neighborhoodTables.prototype.getRandomTable = function() {
    return this._randomPeers;
}

neighborhoodTables.prototype.getRandomPeers = function() {
    return this._randomPeers.getPeers();
}

neighborhoodTables.prototype.containRandomPeer = function(peerId) {
    return this._randomPeers.contain(peerId);
}

neighborhoodTables.prototype.containClusterPeer = function(peerId) {
    return this._clusterPeers.contain(peerId);
}
module.exports = neighborhoodTables;
