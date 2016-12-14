var fs = require('fs'),
    Log = require(process.env.DELEGATE_HOME + '/src/log.js'),
    mkdirp = require('mkdirp'),
    jaccardSimilarity = require(process.env.DELEGATE_HOME + '/src/jaccardMultiset');
    Node = require(process.env.DELEGATE_HOME + '/src/node.js'), 
    PropertiesReader = require('properties-reader'),
    HashMap = require('hashmap');

console.log(process.env.DELEGATE_HOME);

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	properties = PropertiesReader(process.env.DELEGATE_HOME + '/bin/config.properties'),
	startFragment,
	nbClients,
	idClient,
	repBase = process.env.DELEGATE_RES,
	nbRoundsWarmUp,
	nbRoundsReal,
        benchmark,
        numQueries,
	portServer,
        queriesToExecute,
        peer;

if (process.argv.length > 5) {
    startFragment = process.argv[2];
    idClient = Number(process.argv[3]);
    nbClients = Number(process.argv[4]);
    nbRoundsWarmUp = properties.get('nbWarmUpRound');
    nbRoundsReal = properties.get('nbRealRound');
    benchmark = process.argv[5];
    queriesToExecute = process.argv[6];
    numQueries = Number(process.argv[7]) || 0;
    portServer = process.argv[8] || undefined;
    peer = process.argv[9] || undefined;
} else {
    console.error('Error: usage is client startFragment idClient nbClients nbRoundsWarmUp nbRoundsReal benckmark queriesFolder [numQueries] [portServer] [peer]');
    process.exit(1);
}

var nbRandomPeer = properties.get('nbRandomPeer');
var nbClusterPeer = properties.get('nbClusterPeer');
var factor = properties.get('factor');

console.log('ClientBench - startFragment: ', startFragment);
console.log('ClientBench - nbClients: ', nbClients);
console.log('ClientBench - idClient: ', idClient);
console.log('ClientBench - repBase: ', repBase);
console.log('ClientBench - nbRoundsWarmUp: ', nbRoundsWarmUp);
console.log('ClientBench - nbRoundsReal: ', nbRoundsReal);
console.log('ClientBench - portServer: ', portServer);
console.log('ClientBench - peer: ', peer);
console.log('ClientBench - nbRandomPeer: ', nbRandomPeer);
console.log('ClientBench - nbClusterPeer: ', nbClusterPeer);
console.log('ClientBench - benchmark: ', benchmark);


// can remove full predicate issue
var node = new Node('127.0.0.1', nbRandomPeer, nbClusterPeer, jaccardSimilarity, true, startFragment, repBase, portServer, peer);

var idRound = 1, 
    idQuery = 1,
queries = new Array(),
round = 'warmup';

if (benchmark.indexOf('bsbm') > -1)
    createQueriesBSBMParallelization(factor);
//    createQueriesBSBM_powerLaw();
//    createOneQueryBSBM();
//    createQueriesBSBM();
//    createQueriesHalfBSBM();

if (benchmark.indexOf('dbpedia_3_8') > -1)
    createQueriesDBpediaOptimal();
//    createQueriesDBpediaQuater();
//    createQueriesDBpedia();

var rep = repBase + 'warmUpRound_' + idRound + '/';
mkdirp(rep , function (err) {
    if (err != null) console.log(err);
});

node.on('FinishWU', function() {
    console.log('runClient - warmup');
    var idInterval = setInterval(function() {launchRealPhase(idInterval);}, 1000);
});

node.on('FinishReal', function(id) {
    console.log('runClient - real: ', id);
    setInterval(stopClient, 1000);
});

for (idRound; idRound <= nbRoundsWarmUp; idRound++) {

    idQuery = 1;

    var rep = repBase + 'warmUpRound_' + idRound + '/';
    mkdirp(rep , function (err) {
	if (err != null) console.log(err);
    });

    if (queries.length === 0) {
        if (typeof(node._log)  === 'undefined') {
            mkdirp(process.env.DELEGATE_RES + "data" , function (err) {
               if (err != null) console.log(err);
            });
            node._log = new Log(process.env.DELEGATE_RES + "data/" + 'res_' + idClient, node._id);
	    node._fragmentsClient.setLog(node._log);
        }
        fs.writeFileSync(process.env.DELEGATE_RES + "wu_" + idClient, "");
        node.emit('FinishWU');
    }
	
    queries.forEach(function (query) {
	node.query(query, idQuery, 'warmUp', idRound, queries.length, idClient, benchmark);
	idQuery++;
    });

}

var min = 1;

function stopClient() {
    var files = fs.readdirSync(process.env.DELEGATE_RES);
    var nbClientStop = 0;      
    files.forEach(function(file) {
	if (file.indexOf("stop") >= 0) {
	    nbClientStop++;
	    if (nbClientStop === nbClients) {
		node.saveData("_" + min + "min_final");
		process.exit();
	    }
	}
    });
}

function launchRealPhase(idInterval) {
    var files = fs.readdirSync(process.env.DELEGATE_RES),
    nbClientFinishWarmUp = 0;
    files.forEach(function(file) {                                                                                                                                                                           
        if (file.indexOf("wu") >= 0) {                                                                                                                                                                       
            nbClientFinishWarmUp++;                                                                                                                                                                          
            if (nbClientFinishWarmUp === nbClients) {                                                                                                                                                        
		clearInterval(idInterval);
                executeRealPhase();
            }                                                                                                                                                                                                
        }                                                                                                                                                                                                    
    });
}

function executeRealPhase() {
    node.saveData("_warmup");
    node._round = 'real';
    node.clearData();

//    var min = 1;
    setInterval(function() {
	node.saveData("_" + min + 'min');
	min++;
    }, 60000);
    
    idRound = 1;

    for (idRound; idRound <= nbRoundsReal; idRound++) {

	idQuery = 1;

	var rep = repBase + 'realRound_' + idRound + '/';
	mkdirp(rep , function (err) {
	    if (err != null) console.log(err);
	});
   
        if (queries.length === 0) {
            if (typeof(node._log)  === 'undefined') {
                mkdirp(process.env.DELEGATE_RES + "data" , function (err) {
                    if (err != null) console.log(err);
                });
                node._log = new Log(process.env.DELEGATE_RES + "data/" + 'res_' + idClient, node._id);
            }
            fs.writeFile(process.env.DELEGATE_RES + "stop_" + idClient, "", function(err)  {if (err) throw err;});
            node.emit('FinishReal', idRound);
        }
 
	queries.forEach(function (query) {
	    node.query(query, idQuery, 'real', idRound, queries.length, idClient, benchmark);
            idQuery++;
	});
    }

    /*var rep = repBase + 'realRound_' + idRound + '/';
    mkdirp(rep , function (err) {
	if (err != null) console.log(err);
    });

    round = 'real';
    idQuery = 1;
    createQueriesDelatedBSBM();*/
}



function createQueriesBSBMParallelization(nbC) {
    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "/");
    console.log('\t', nbC, typeof(nbC));
    if (nbC === 50) {
	for (j = 1; j <= 8; j++) {
	    idQuery = 1;
	    for (idQuery; idQuery < 26; idQuery++) {
		var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + j + "_" + idQuery).toString();
		console.log('Queries:', j, ' ', idQuery);
		queries.push(query);
	    }
        }
    } else if (nbC === 2) {
	if (idClient < 26) {
	    for (j = 1; j <= 8; j++) {
		idQuery = 1;
		for (idQuery; idQuery < 26; idQuery++) {
		    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + j + "_" + idQuery).toString();
		    console.log('Queries:', j, ' ', idQuery);
		    queries.push(query);
		}
            }
	}
    } else if (nbC === 1) {
	if (idClient === 1) {
	    for (j = 1; j <= 8; j++) {
		idQuery = 1;
		for (idQuery; idQuery < 26; idQuery++) {
		    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + j + "_" + idQuery).toString();
		    console.log('Queries:', j, ' ', idQuery);
		    queries.push(query);
		}
            }
	}
    }
}

function createQueriesBSBM_powerLaw() {
    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "_powerLaw/");
    var nbQueries = JSON.parse(fs.readFileSync('/home/folz/queries/queries_bsbm10_powerLaw/queryDistribution').toString())[idClient - 1];
    if (nbQueries > 0) {
	for (idQuery; idQuery <= nbQueries; idQuery++) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "_powerLaw/query_" + idClient + "_" + idQuery).toString();
	    console.log('Queries:', idClient, ' ', idQuery);
	    queries.push(query);
	}
    }
}

function createQueriesMultipleBSBM() {
    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "/");
    for (idQuery; idQuery < 26; idQuery++) {
	if (idClient > 0 && idClient < 11) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + 1 + "_" + idQuery).toString();
	    console.log('Queries:', "query_" + 1 + "_" + idQuery);
	    queries.push(query);
	} else if (idClient > 10 && idClient < 21) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + 2 + "_" + idQuery).toString();
	    console.log('Queries:', "/query_" + 2 + "_" + idQuery);
	    queries.push(query);
	} else if (idClient > 20 && idClient < 31) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + 3 + "_" + idQuery).toString();
	    console.log('Queries:', "/query_" + 3 + "_" + idQuery);
	    queries.push(query);
	} else if (idClient > 30 && idClient < 41) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + 4 + "_" + idQuery).toString();
	    console.log('Queries:', "/query_" + 4 + "_" + idQuery);
	    queries.push(query);
	} else if (idClient > 40 && idClient < 51) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + 5 + "_" + idQuery).toString();
	    console.log('Queries:', "/query_" + 5 + "_" + idQuery);
	    queries.push(query);
	}
    }
}

function createQueriesDelatedBSBM() {
    var idInt = setInterval(function() {
	if (idQuery < 26) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + idClient + "_" + idQuery).toString();
	    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "/");
	    if (round === 'warmup')
		node.query(query, idQuery, 'warmUp', idRound, 25, idClient, benchmark);
	    else
		node.query(query, idQuery, 'real', idRound, 25, idClient, benchmark);
	    idQuery++;
	} else {
	    clearInterval(idInt);
	}
    }, 10000);
}

function createQueriesHalfBSBM() {
    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "/");
    if (idClient < 26) {
	for (idQuery; idQuery < 26; idQuery++) {
	    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + idClient + "_" + idQuery).toString();
	    console.log('Queries:', idClient, ' ', idQuery);
	    queries.push(query);
	}
    }
}

function createQueriesBSBM() {
    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "/");
    for (idQuery; idQuery < 26; idQuery++) {
		var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + idClient + "_" + idQuery).toString();
	        console.log('Queries:', idClient, ' ', idQuery);
		queries.push(query);
    }
}

function createOneQueryBSBM() {
    console.log('Queries from: ', "/home/folz/queries/queries_" + benchmark + "/");
    var query = fs.readFileSync("/home/folz/queries/queries_" + benchmark + "/query_" + idClient + "_1").toString();
    console.log('Queries:', idClient, ' ', idQuery);
    queries.push(query);
}



function createQueriesDBpediaOptimal() {
    // Map query id to unique query id
    /*var queriesList = fs.readdirSync("/home/montoya/tmp/queries_dbpedia_3_8/");

    var mapQuery = new HashMap();
    var id = 1;
    for (var i = 1; i <= 50; i++) {
	var nb = 0;
	queriesList.forEach(function(query) {
	    if (query.indexOf("query_" + i + "_") > -1) {
		nb = nb + 1;
	    }
	});
	
	for (var j= 1; j <= nb; j++) {
	    mapQuery.set(id, "query_" + i + "_" + j);
	    id = id + 1;
	}
    }*/
    
    
    var distribution = fs.readFileSync("/home/folz/LADDA/parallelizationGainOptimal/distribution12Clients").toString().split('\n');
    if (idClient < 13) {
	var list = distribution[idClient - 1].split(" ");
	for (var k = 1; k < list.length; k ++) {
	 //   query = fs.readFileSync("/home/montoya/tmp/queries_dbpedia_3_8/" + mapQuery.get(parseInt(list[k]))).toString();
	    query = fs.readFileSync("/home/montoya/tmp/queries_dbpedia_3_8/" + list[k]).toString();
	    queries.push(query);
	}
    }
}


function createQueriesDBpediaQuater() {
    var busyClient = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 50];
    var path = '/home/montoya/tmp/queries_dbpedia_3_8/';
    var directory = fs.readdirSync(path);
    var index = busyClient.indexOf(idClient);

    if (index > -1) {
	var lowerBound = 0;
	if (index > 0)
	    lowerBound = busyClient[index- 1];
	directory.forEach(function(file) {
	    s = file.split('_');
	    if (s[1] <= idClient && s[1] > lowerBound) {
		query = fs.readFileSync(path + file).toString();
		queries.push(query);
	    }
	});
    }

}

function createQueriesDBpedia() {
    console.log('Queries from: ', queriesToExecute);
    var lines = fs.readFileSync(queriesToExecute).toString().split('\n');
    lines.forEach(function (line) {
        if (line && (line !== '')) {
            var query = fs.readFileSync(line).toString();
            console.log('Queries:', idClient, ' ', idQuery);
            queries.push(query);
            idQuery++;
        }
    });
    console.log('numQueries: ', (idQuery-1));
}

function getCurrentDate() {
	var today = new Date(),
		day = today.getDate(),
		month = months[today.getMonth()], // getMonth() start with 0
		year = today. getFullYear(),
		hour = today.getHours(),
		min = today.getMinutes(),
		sec = today.getSeconds(),
		ms = today.getMilliseconds(),
		fullDate = day + '/' + month + '/' + year + ':' + hour + ':' + min + ':' + sec + ':' + ms;
	return fullDate;
}




