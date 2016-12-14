/* A Server*/
var io = require('socket.io'),
Client = require('./client.js'),
http = require('http'),
cacheToProfile = require('./cacheToProfile');
PropertiesReader = require('properties-reader'),
Logger = require('./node_modules/Client.js-feature-asynciterator/ldf-client.js').Logger,
status = require('./status'),
freeport = require('freeport');

var nbAnswer = 0;

var nbReceiveQueries = 0;
var nbAnswerQueries = 0;

function Server(node) {
    this._node = node;
    this._id = node._id;
    this._ip = node._ip;
    this._port = node._port;
    this._tables = node._tables;
    this._cache = node._cache;
    this._profile = node._profile;
    this._client = node._client;
    this._sockets;
    this._properties = PropertiesReader(process.env.DELEGATE_HOME + '/bin/config.properties');
    this._logger = new Logger('Server');

    this._logger.info('Start: ', this._address);

    if (this._port === 'undefined')
	this._generatePort();
    else
	this.start();

}

Server.prototype._generatePort = function () {
    var self = this;
    freeport(function(err, port) {
        if (err) throw err;
        self._node._port = port;
	self._node._client._port = port;
	self._port = self._node._port
        if (typeof(self._port) === 'undefined') 
	    generatePort();
	else 
	    self.start();
    });
}

Server.prototype.start = function (socketServer) {

    this._address = this._ip + ':' + this._port;


    var server = http.createServer();

    server.listen(this._port);


    io = io.listen(server);

    this._sockets = io.sockets;

    var self = this;

    io.sockets.on('connection', function (socket) {
	socket.on('error', function (err) {
	    self._logger.error('Socket: ', err);
	    console.trace(err);
	});
	
        // First exchange
        socket.on('demandNewConnection', function (msg) {
	    self._node._log.incrementServerNbShufReceived();
	    
            // Add the new connected peer
	    self._logger.info('DemandNewConnection: ', msg.src.adr);

            var peer = msg.content;

            socket.idPeer = peer.id;
            socket.address = msg.src.adr;

            var repInfo = {
                'src': {'id': self._id, 'adr': self._address},
                'dst': msg.src,
                'content': {
                    'id': self._id,
                    'ip': self._ip,
                    'port': self._port,
                    'profile': JSON.stringify(self._profile.toObject())
                }
            };
	    self._logger.debug('Answerbuild');
            socket.emit('answerDemandeNewConnection', repInfo);
	    self._node._log.incrementServerNbShufSent();
	    
	    // Construct the network at the beginnning
	    if (!self._tables.RandomPeersFull()) {
		var newPeer = {
                    'id': peer.id,
                    'ip': peer.ip,
                    'port': peer.port,
                    'profile': peer.profile,
                    'timestamp': 0
		};
		self._tables.addRandomPeer(newPeer);
	    }
        });


        socket.on('exchangeNeighbourhoodTablesClientToServer', function (msg) {
	    self._node._log.incrementServerNbShufReceived();

	    self._logger.info('ReceivePeers: ', msg.src.adr);
          
            self._tables.updateProfile(msg.src.id, JSON.parse(msg.src.profile));

	    var content = self._sendNeigborhoodTables(socket.idPeer);
	    var msg = {'dst': socket.address, 'src': {'id': self._id, 'adr': self._address, 'profile': JSON.stringify(self._profile.toObject())}, 'content': content};

            socket.emit('exchangeNeighbourhoodTablesServerToClient', msg);
	    self._node._log.incrementServerNbShufSent();

            self._receiveNeigborhoodTables(msg.content);
	    
        });

	socket.on('delegateQuery', function(query) {
	    self._node._log.incrementServerNbAskReceived();

	    console.log('Server - nbAskReceived: ');
	    var execute = self.canExecute(query),
	    msg = {execute: execute, query: query};
	    console.log('Server - delegateQuery: ', query.id, query.round, execute);
	    console.log('\t from: ', socket.address);
	    socket.emit('status', msg);
	    self._node._log.incrementServerNbAskSent();

	    console.log('Server - nbAskSent: ');
	});

	socket.on('executeQuery', function(query) {
	    self._node._log.incrementServerNbExecuteReceived();
	    
	    if (self._node._status != status.EXECUTING && self._node._round === query.round.type && !self._node._hasWaitingQueries()) {
//	    if (self._node._status != status.EXECUTING) {
                var finished = false;
		console.log('Server - going to executeQuery: ', self._node._status);
		self._node._status = status.EXECUTING;
		console.log('Server - nbExecuteReceived: ');

		console.log('Server.js - executeQuery: ', query.id, query.round);
		console.log('\t from: ', socket.address);
	    
		console.log('EQ-S: ', query.id, query.round);
                if (query.round.type === "real") {
                    console.time('timeExecDel');
                }
		var res = self._node.execQuery(query, true);

		var buffer = '';
		res.on('data', function(data) {
		    buffer += JSON.stringify(data);
		    if (buffer.length === 100) {
			socket.emit('res', {query: query, answer: buffer});
			
			self._node._log.incrementServerNbExecuteSent();
			console.log('Server - nbExecuteSent: ');

			buffer = '';
		    } 
		});

		res.on('end', function() {
		    console.log('end for: ', query.id);
		    if (buffer.length > 0) {
			socket.emit('res', {query: query, answer: buffer});

			self._node._log.incrementServerNbExecuteSent();
			console.log('Server - nbExecuteSent: ');

			buffer = '';
		    }
		    socket.emit('res', {query: query, answer: 'finish'});

                    finished = true;

		    self._node._log.incrementServerNbExecuteSent();
		    self._node._log.incrementStateNodeLocal();

		    console.log('Server - nbExecuteSent: ');

		    self._node._status = status.FREE;
                    if (query.round.type === "real") {
                        console.timeEnd('timeExecDel');
                    }
		    self._node.emit('FINISH');
		});
                /*setTimeout(function() {
                    if (!finished) {
                        console.log('Server - delegated query execution timed out: query', query.id);
                        self._node._status = status.FREE;
                        if (query.round.type === "real") {
                            console.timeEnd('timeExecDel');
                        }
                        if (res) {
                            res.close();
                        }
                        self._node.emit('FINISH');
                    }
                }, self._properties.get('timePerformQuery'));*/
	    } else {
		socket.emit('res', {query: query, answer : 'busy'});
		self._node._log.incrementServerNbExecuteSent();
	    }
	});

        socket.on('disconnect', function (msg) {
	    // Suppose that no clients is crashing during experiment
	    // comment in order to log data
/*	    if (self._tables.containRandomPeer(socket.idPeer))
		self._tables.removePeer(socket.idPeer);*/
        });
    });


    if (typeof(self._node._peer) != 'undefined') {
	console.log('Server - peerToConnect: ', self._node._peer);
	self._node._client.connectTo(self._node._peer, true); 
    }

    self._node._status = status.FREE;
    self._node.emit('FINISH');

};

Server.prototype.canExecute = function (query) {
    if ((this._node._round === query.round.type) && (this._node._status === status.FREE || this._node._status === status.DELEGATING))
	return true;
    else
	return false;
}

Server.prototype.getNbReceiveQueries = function() {
    return nbReceiveQueries;
}

Server.prototype.resetNbReceiveQueries = function() {
    console.log('reset receive queries');
    nbReceiveQueries = 0;
}

Server.prototype.getNbAnswerQueries = function() {
    return nbAnswerQueries;
}

Server.prototype.resetNbAnswerQueries = function() {
    console.log('reset nb answer queries');
    nbAnswerQueries = 0;
}

Server.prototype._sendNeigborhoodTables = function (peerId) {
    return this._tables.sendNeigborhoodTables(peerId);
}

Server.prototype._receiveNeigborhoodTables = function (peers) {
    var peersToDelete = this._tables.receiveNeigborhoodTables(peers);
    this._client.tryNewConnections(peers);
}

module.exports = Server;
