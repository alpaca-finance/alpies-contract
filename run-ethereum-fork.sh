if [ -f .env ]
then
  export $(cat .env | sed 's/#.*//g' | xargs)
fi

if [ -z ${ETH_MAINNET_ARCHIVE_RPC:-} ]; then
    echo "environments are invalid"
else
    echo "creating a mainnet fork node ${ETH_MAINNET_ARCHIVE_RPC}"
    npx hardhat node --fork ${ETH_MAINNET_ARCHIVE_RPC} --no-deploy
fi;