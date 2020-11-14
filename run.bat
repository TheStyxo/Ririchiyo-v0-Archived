echo off
cls
echo Starting Bot and Lavalink Server
java -jar lavalinkServer/Lavalink.jar
node src/main/shardingManager.js
pause