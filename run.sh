if [ "$(docker ps -a | grep whodaresc)" ]
then
  docker start whodaresc > /dev/null
  docker exec -it whodaresc bash
else
  docker run -it --name whodaresc -e DISPLAY --privileged --user $(id -u):$(id -g) -v $(pwd)/../whodares:/home/apps/whodares -v $(pwd)/../whodares/server:/go/src/whodares/server --network=host whodares:latest bash
fi