#!/bin/bash

source $DELEGATE_HOME/bin/config.properties

#newNbClient=""
#j=0
#for i in "${datasets[@]}"
#do
#    if [ "${i}" == "dbpedia_3_8" ]; then
#        cs=""
#        for f in `ls /home/montoya/tmp/queries_dbpedia_3_8/`; do
#        for f in `ls /home/montoya/tmp/queries_dbpedia_3_8_test_1/`; do
#            x=${f#query_}
#            h=${x##*_}
#            c=${x%%_*}
#            x=`grep -w "${c}" <<< ${cs}`
#            if [ -z "${x}" ]; then
#                cs="${cs} $c"
#            fi
#        done
#        nc=`wc -w <<< $cs`
#        newNbClient="$newNbClient ${nc}"
#    else
#        newNbClient="$newNbClient ${nbClient[$j]}"
#    fi
#    j=$(($j+1))
#done
#nbClient=(${newNbClient})


nbTotalClient=0
for i in "${nbClient[@]}"
do
    nbTotalClient=$(($nbTotalClient+$i))
done    

# Clear cache
err=$(rm -rf /var/cache/nginx/cache/* 2>&1)
del=0
while [ $del -eq 0 ]
do
    if [[ $err =~ ^rm.* ]]
    then
	err=$(rm -rf /var/cache/nginx/cache/* 2>&1)
	if [[ $err != *"rm"* ]]; then
	    del=1
	fi
    else
	del=1
    fi
done

resRepBase=$DELEGATE_HOME"/res/${nbTotalClient}_clients/"

mkdir -p $resRepBase 

export DELEGATE_RES=$resRepBase

cp $DELEGATE_HOME/bin/config.properties $resRepBase

cycleFile=${resRepBase}cycle_${nbClient}

j=0
idGlobalClient=1
declare -a clientPid
# For each chunk of client
for i in "${nbClient[@]}"
do
    nbClient=$i
    dataset=${datasets[$j]}
    j=$(($j+1))

    idClient=1

    while [ $idClient -le $nbClient ]
    do
        if [ "${dataset}" == "dbpedia_3_8" ]; then
            x=$((idClient % ${factor}))
            nq=0
            queriesToExecute=`mktemp`
            touch ${queriesToExecute}
            if [ "$x" -eq "0" ]; then
                  for k in `seq 0 $((${factor}-1))`; do
                      l=$((${idClient}-${k}))
                      ls "${queriesFolder}"/query_"${l}"_* >> ${queriesToExecute}
                  done
                  nq=`wc -l ${queriesToExecute} | sed 's/^[ ^t]*//' | cut -d' ' -f1`
            fi
        else
            nq=undefined
            queriesToExecute=undefined
        fi
	logFile=${resRepBase}callsDone_${idGlobalClient}

	declare -a pid
	res=$((idGlobalClient % 5))
	echo ${res}
	if [ $idGlobalClient -eq 1 ] || [ $res -eq 0 ]
	then
            echo 'Is 1 or multiple of 5'
            if [ $idGlobalClient != 1 ]
            then
		peerAdr="http://127.0.0.1:${lastServer}"
		lastServer=$(($lastServer+1))

		nohup nodejs bin/runClient.js "${startFragment}${dataset}" $idGlobalClient $nbTotalClient $dataset ${queriesToExecute} ${nq} $lastServer $peerAdr >>$logFile 2>&1 &
		pid=`ps -ef | grep "bin/runClient.js "${startFragment}${dataset}" ${idGlobalClient} ${nbTotalClient} ${dataset} ${queriesToExecute} ${nq} ${lastServer} ${peerAdr}" | awk {'print $2'}`

            else
		nohup nodejs bin/runClient.js "${startFragment}${dataset}" $idGlobalClient $nbTotalClient $dataset ${queriesToExecute} ${nq} $lastServer $peerAdr >>$logFile 2>&1 &
		pid=`ps -ef | grep "bin/runClient.js "${startFragment}${dataset}" ${idGlobalClient} ${nbTotalClient} ${dataset} ${queriesToExecute} ${nq} ${lastServer} ${peerAdr}" | awk {'print $2'}`

            fi
	else
            echo 'Is simple client'
            peerAdr="http://127.0.0.1:${lastServer}"

	    nohup nodejs bin/runClient.js "${startFragment}${dataset}" $idGlobalClient $nbTotalClient ${dataset} ${queriesToExecute} ${nq} undefined $peerAdr >>$logFile 2>&1 &
	    pid=`ps -ef | grep "bin/runClient.js "${startFragment}${dataset}" ${idGlobalClient} ${nbTotalClient} ${dataset} ${queriesToExecute} ${nq} undefined ${peerAdr}" | awk {'print $2'}`

	fi

	echo "Pid for ${idGlobalClient} true"
	echo ${pid}
	clientPid[${idGlobalClient}]=${pid}
	

	idClient=$(($idClient+1))
	idGlobalClient=$(($idGlobalClient+1))
    done
done

for p in "${clientPid[@]}"
do
    wait ${p}
done

