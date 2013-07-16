open OUTFILE, "> /tmp/test.txt" or die "could not open outfile";
print OUTFILE "test";
close OUTFILE;
