
lines = open('src/index.ts').readlines()
# We want to remove lines 641 to 1162 inclusive (1-based)
# In 0-based indexing:
# Line 641 is index 640.
# Line 1162 is index 1161.
# So we want to keep lines[:640] and lines[1162:]

# Check consistency before writing
print(f"Line 641 (index 640) starts with: {lines[640][:20]}")
print(f"Line 1162 (index 1161) is: {lines[1161]}")

lines_to_keep = lines[:640] + lines[1162:]
with open('src/index.ts', 'w') as f:
    f.writelines(lines_to_keep)
