import subprocess
import os

def stitch_segments(segments, output_path):
    list_file = 'segments.txt'
    with open(list_file, 'w', encoding='utf-8') as f:
        for s in segments:
            f.write(f"file '{s}'\n")
    cmd = [
        'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_file,
        '-c', 'copy', output_path
    ]
    subprocess.run(cmd, check=True)
    os.remove(list_file)

if __name__ == '__main__':
    pass
