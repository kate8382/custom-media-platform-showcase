import json
import re
import os


def extract_track_data(content):
	"""
	Parses the text file into blocks and extracts data based on strict Regex.
	Parses the text file content using Regex to extract specific Bandcamp parameters.
	Returns a list of valid track objects and a list of skipped block indices.
	Ensures TrackName stops at the first newline.
	Does not assign TrackNumber here to ensure clean merging later.
	"""

	# Split text into sections starting with "Song:"
	blocks = re.split(r"(?=Song:)", content)
	blocks = [b.strip() for b in blocks if b.strip()]

	valid_tracks_data = []
	skipped_indices = []

	# Regex Patterns
	patterns = {
		"TrackName": r"Song:\s*([^\r\n]+)",
		"Width": r"width:\s*(\d+)(px|%)",
		"Height": r"height:\s*(\d+)(px|%)",
		"TrackId": r"track=(\d+)",
		"Size": r"size=(large|small)",
		"BgCol": r"bgcol=([a-fA-F0-9]{3,6})",
		"LinkCol": r"linkcol=([a-fA-F0-9]{3,6})",
		"TrackList": r"tracklist=(true|false)",
		"Transparent": r"transparent=(true|false)",
		"AnchorTrackName": r"href=\"[^\"]+/track/([^\"]+)\"",
		"AnchorText": r"<a [^>]*>(.*?)</a>",
	}

	for index, block in enumerate(blocks, 1):
		extracted = {}
		is_valid = True

		for key, pattern in patterns.items():
			# TrackName stops at the newline; others allow multiline (DOTALL)
			match = (
				re.search(pattern, block)
				if key == "TrackName"
				else re.search(pattern, block, re.DOTALL)
			)
			if not match:
				is_valid = False
				break
			extracted[key] = match

		if not is_valid:
			skipped_indices.append(index)
			continue

		# Create the track object WITHOUT TrackNumber
		track_entry = {
			"TrackName": extracted["TrackName"].group(1).strip(),
			"BandcampEmbedInfo": {
				"TrackId": int(extracted["TrackId"].group(1)),
				"AnchorTrackName": extracted["AnchorTrackName"].group(1),
				"AnchorText": extracted["AnchorText"].group(1).strip(),
				"EmbedStyle": {
					"IFrameSize": extracted["Size"].group(1),
					"IFrameWidth": {
						"Amount": int(extracted["Width"].group(1)),
						"Units": extracted["Width"].group(2),
					},
					"IFrameHeight": {
						"Amount": int(extracted["Height"].group(1)),
						"Units": extracted["Height"].group(2),
					},
					"BackgroundColor": extracted["BgCol"].group(1),
					"LinkColor": extracted["LinkCol"].group(1),
					"TrackListShow": extracted["TrackList"].group(1) == "true",
					"TransparentShow": extracted["Transparent"].group(1) == "true",
				},
			},
		}
		valid_tracks_data.append(track_entry)

	return len(blocks), valid_tracks_data, skipped_indices


def main():
	txt_filename = "bandcamp_embeds.txt"
	json_filename = "track_data.json"

	# Load or initialize the JSON structure
	if os.path.exists(json_filename):
		with open(json_filename, "r", encoding="utf-8") as f:
			try:
				data = json.load(f)
			except json.JSONDecodeError:
				data = {
					"ArtistName": "",
					"BandcampURL": "",
					"TotalPublishedTracks": 0,
					"Tracks": [],
				}
	else:
		data = {
			"ArtistName": "",
			"BandcampURL": "",
			"TotalPublishedTracks": 0,
			"Tracks": [],
		}

	if not os.path.exists(txt_filename):
		print(f"Error: {txt_filename} not found.")
		return

	with open(txt_filename, "r", encoding="utf-8") as f:
		content = f.read()

	total_processed, new_tracks, skipped_blocks = extract_track_data(content)

	existing_ids = {
		t["BandcampEmbedInfo"]["TrackId"]
		for t in data["Tracks"]
		if "BandcampEmbedInfo" in t
	}
	added_count = 0

	for track in new_tracks:
		if track["BandcampEmbedInfo"]["TrackId"] not in existing_ids:
			# Determine the new track number
			new_number = len(data["Tracks"]) + 1

			# Construct a new dictionary starting with TrackNumber to ensure order
			ordered_entry = {"TrackNumber": new_number}
			ordered_entry.update(track)

			data["Tracks"].append(ordered_entry)
			added_count += 1

	# Update global count
	data["TotalPublishedTracks"] = len(data["Tracks"])

	with open(json_filename, "w", encoding="utf-8") as f:
		json.dump(data, f, indent=4)

	print("-" * 35)
	print(f"Total Blocks Processed: {total_processed}")
	print(f"New Tracks Added:       {added_count}")
	print(f"Blocks Skipped:         {len(skipped_blocks)}")
	if skipped_blocks:
		print(f"Skipped Block Numbers:  {', '.join(map(str, skipped_blocks))}")
	print("-" * 35)


if __name__ == "__main__":
	main()
