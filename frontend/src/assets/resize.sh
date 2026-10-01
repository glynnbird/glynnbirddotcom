#!/bin/bash
counter=0
for filename in * ; do
  if [[ $filename != *.thumb.jpg ]] ;
  then
    if [[ $filename != *.gif ]];
    then
      if [[ $filename != 'resize.sh' ]] ;
      then
        thumb="$filename.thumb.jpg"
        if [[ ! -f $thumb ]];
        then
          echo $thumb
          magick "$filename" -resize '400x300>' "$thumb"
          counter=$((counter+1))
        fi
      fi
    fi
  fi
done
echo "$counter images thumbnailed"
exit $counter
