# Ladda

Ladda is a framework to build a federation of linked data consumers
where data consumers are connected together, share their SPARQL processing capabilities
and parallelize their queries by delegating them to idle data consumers. 
Ladda implements a dynamic load-balancer that enables inter-query parallelism over TPF clients.

This repo exposes the benchmark code, queries and plots.

# Online Demo

An online demo of query delegation through browser in a federation of linked data consumers is available at:
http://ladda-demo.herokuapp.com/ and a live video at: https://www.youtube.com/watch?v=YQsVgJHV5nw

This demo requires browsers able to handle WebRTC connections, such as Firefox or Chrome.

You need to open at least two tabs in your browser in order to delegate queries.

The Github project of the demo is available at: https://github.com/folkvir/ladda-demo

# Plots

### [Longest Processing Time (LPT) allocation - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/staticAllocation_1run.pdf)

  Execution time of 1509 queries from DBPedia log 3.8, statically allocated to 1,
  21 and 50 TPF clients. TPF server is configured with 1, 4 and 8 workers.
  
### [Number of calls resolved by the TPF server - 1 run] (https://github.com/pfolz/Ladda/blob/master/plots/nbCallsServer.pdf)

  Regardless the configuration, the TPF server handle less calls with Ladda 2 (L2) than No Delegation (ND), i.e., the Web 
  cache is more efficient when queries are parallelized. Bellow is a table with the precise numbers.
  
  Configuration | Approach | TPF server's calls | Total external calls (1) | Makespan
  --------------|----------|--------------------|--------------------------|---------
  All Loaded | ND | 623161 | 703823 | ~ 9 min 31 sec
             | L2 | 534841 | 705664 | ~ 5 min
  Half Loaded | ND | 630842 | 704083 | ~ 10 min
              | L2 | 558738 | 706788 | ~ 5 min
  One Loaded | ND | 704415 | 705458 | ~ 35 min 25 sec
             | L2 | 563831 | 707932 | ~ 4 min
             
 (1) This sum do not take into consideration calls resolved in the local cache of clients.

### Experiment on the local cache of TPF client

#### [With BSBM dataset - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/localCaceXp_BSBM10M_Warmup_1run.pdf)

  TPF client performing BSBM queries, with local cache reset on and off between
  queries execution. Cache hit is the number of triple pattern queries answered locally and
  cache miss is the number of triple pattern queries answered by the server.
  
#### [With DBpedia dataset - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/localCacheXp_DBpedia_Warmup_1run.pdf)

  TPF client performing DBpedia queries, with local cache reset on and off between
  queries execution. Cache hit is the number of triple pattern queries answered locally and
  cache miss is the number of triple pattern queries answered by the server.
  
### [Makespan of the federation - Average on 3 runs](https://github.com/pfolz/Ladda/blob/master/plots/makespan_Avg_3runs.pdf)
  Overall makespan for Ladda 2 (L2) , Ladda K (LK) and our baseline “No
  Delegation” (ND) in the configuration All Loaded, Half Loaded, One Loaded and
  Quarter Loaded.
  
### [Throughput of the federation - Average on 3 runs](https://github.com/pfolz/Ladda/blob/master/plots/throughput_Avg_3runs.pdf)

  The number of queries executed per second for Ladda 2 (L2) , Ladda K (LK) and
  our baseline “No Delegation” (ND) in the configuration All Loaded, Half Loaded, One
  Loaded and Quarter Loaded.

### Number of queries executed per minute

#### [Configuration: All Loaded - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/nbExecQueries_AllLoaded_1run.pdf)

  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration All Loaded.
  
#### [Configuration: Half Loaded - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/nbExecQueries_HalfLoaded_1run.pdf)

  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration Half Loaded.
  
#### [Configuration: Quarter Loaded - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/nbExecQueries_QuarterLoaded_1run.pdf)

  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration Quarter Loaded.
  
#### [Configuration: One Loaded - 1 run](https://github.com/pfolz/Ladda/blob/master/plots/nbExecQueries_OneLoaded_1run.pdf)
  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration One Loaded.
  
### Results time per client
  
#### [Configuration: All Loaded - Average on 3 runs](https://github.com/pfolz/Ladda/blob/master/plots/resultsTimePerClient_AllLoaded_Avg_3runs.pdf)

  Results time per client with Ladda 2, Ladda K and ND (No Delegation) for the
  All Loaded configuration.
  
#### [Configuration: Half Loaded - Average on 3 runs](https://github.com/pfolz/Ladda/blob/master/plots/resultsTimePerClient_HalfLoaded_Avg_3runs.pdf)

  Results time per client with Ladda 2, Ladda K and ND (No Delegation) for the
  Half Loaded configuration: 25 clients with discontinuous ID.
  
#### [Configuration: Quarter Loaded - Average on 3 runs](https://github.com/pfolz/Ladda/blob/master/plots/resultsTimePerClient_QuaterLoaded_Avg_3runs.pdf)

  Results time per client with Ladda 2, Ladda K and ND (No Delegation) for the
  Quarter Loaded configuration: 12 clients with discontinuous ID.
  
