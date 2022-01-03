#!/usr/bin/python3

import sys
import pyvips

image = pyvips.Image.new_from_file(sys.argv[1])
left, top, width, height = image[3].find_trim(background=0, threshold=20)
image = image.crop(left, top, width, height)
image.write_to_file(sys.argv[2])
