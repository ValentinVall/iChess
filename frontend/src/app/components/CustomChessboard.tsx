import { useMemo } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { motion } from "motion/react";

interface ChessboardProps {
  position: string; // FEN string
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  onSquareClick?: (square: string) => void;
  selectedSquare?: string | null;
  possibleMoves?: string[];
  lastMoveSquares?: string[];
  checkSquare?: string | null;
  checkmateSquare?: string | null;
  boardOrientation?: "white" | "black";
  disabled?: boolean;
}

const PIECE_IMAGES: Record<string, string> = {
  K: "/pieces/king-w.svg", Q: "/pieces/queen-w.svg", R: "/pieces/rook-w.svg", B: "/pieces/bishop-w.svg", N: "/pieces/knight-w.svg", P: "/pieces/pawn-w.svg",
  k: "/pieces/king-b.svg", q: "/pieces/queen-b.svg", r: "/pieces/rook-b.svg", b: "/pieces/bishop-b.svg", n: "/pieces/knight-b.svg", p: "/pieces/pawn-b.svg",
};

function parseFEN(fen: string): Record<string, string> {
  const position: Record<string, string> = {};
  const ranks = fen.split(" ")[0].split("/");
  
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  
  ranks.forEach((rank, rankIndex) => {
    let fileIndex = 0;
    for (const char of rank) {
      if (char >= "1" && char <= "8") {
        fileIndex += parseInt(char);
      } else {
        const square = files[fileIndex] + (8 - rankIndex);
        position[square] = char;
        fileIndex++;
      }
    }
  });
  
  return position;
}

interface SquareProps {
  square: string;
  piece: string | null;
  isLight: boolean;
  onDrop: (sourceSquare: string, targetSquare: string) => void;
  onSquareClick?: (square: string) => void;
  isSelected?: boolean;
  isPossibleMove?: boolean;
  isLastMove?: boolean;
  isCheck?: boolean;
  isCheckmate?: boolean;
  disabled?: boolean;
  rankLabel?: string;
  fileLabel?: string;
}

function Square({ 
  square, 
  piece, 
  isLight, 
  onDrop,
  onSquareClick,
  isSelected = false,
  isPossibleMove = false,
  isLastMove = false,
  isCheck = false,
  isCheckmate = false,
  disabled = false,
  rankLabel,
  fileLabel,
}: SquareProps) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: "piece",
      item: { square },
      canDrag: () => !!piece && !disabled,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [piece, square, disabled]
  );

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: "piece",
      drop: (item: { square: string }) => {
        onDrop(item.square, square);
      },
      canDrop: () => !disabled,
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [square, disabled]
  );

  return (
    <div
      ref={(node) => drag(drop(node))}
      onClick={() => !disabled && onSquareClick?.(square)}
      className={`
        aspect-square flex items-center justify-center relative
        ${isLastMove ? isLight ? "bg-[#ffffab]" : "bg-[#ebeb7a]" : isLight ? "bg-[#f5f5f5]" : "bg-[#c9c9c9]"}
        ${isCheckmate ? "ring-inset ring-4 ring-red-500" : isCheck ? "ring-inset ring-4 ring-yellow-400" : ""}
        ${isSelected ? "ring-inset ring-4 ring-blue-400" : ""}
        ${isOver ? "ring-2 ring-white/40 ring-inset" : ""}
        ${isDragging ? "opacity-50" : ""}
        ${!disabled ? "cursor-pointer" : "cursor-not-allowed"}
        select-none transition-all
      `}
    >
      {rankLabel ? (
        <span className="absolute left-1.5 top-1 z-10 text-[10px] font-semibold leading-none text-black/45">
          {rankLabel}
        </span>
      ) : null}

      {fileLabel ? (
        <span className="absolute bottom-1 right-1.5 z-10 text-[10px] font-semibold uppercase leading-none text-black/45">
          {fileLabel}
        </span>
      ) : null}

      {/* Possible move indicator */}
      {isPossibleMove && !piece && (
        <div className="absolute h-4.5 w-4.5 rounded-full bg-yellow-400/55 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
      )}
      
      {/* Capture indicator */}
      {isPossibleMove && piece && (
        <div className="absolute inset-[11%] rounded-full border-[3px] border-yellow-400/65 bg-yellow-300/6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
      )}
      
      {/* Piece */}
      {piece && (
        <motion.img
          layoutId={piece ? `piece-${piece}-on-${square}` : undefined}
          src={PIECE_IMAGES[piece]}
          alt={`${piece}`}
          className="w-[75%] h-[75%] pointer-events-none"
          draggable={false}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: 0.3
          }}
        />
      )}
    </div>
  );
}

export function CustomChessboard({
  position,
  onPieceDrop,
  onSquareClick,
  selectedSquare,
  possibleMoves = [],
  lastMoveSquares = [],
  checkSquare,
  checkmateSquare,
  boardOrientation = "white",
  disabled = false
}: ChessboardProps) {
  const board = useMemo(() => parseFEN(position), [position]);
  
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  
  if (boardOrientation === "black") {
    files.reverse();
    ranks.reverse();
  }

  const handleDrop = (sourceSquare: string, targetSquare: string) => {
    if (sourceSquare !== targetSquare) {
      onPieceDrop(sourceSquare, targetSquare);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-black/5 p-3 md:p-4 backdrop-blur-xl shadow-[0_28px_65px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_50%),linear-gradient(135deg,rgba(0,0,0,0.02),transparent)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_50%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent)]" />
        <div className="relative aspect-square rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-[#fafafa] to-[#dddddd] p-2.5 md:p-3 shadow-inner dark:border-white/10 dark:from-[#232323] dark:to-[#121212]">
          <div className="overflow-hidden rounded-[1.2rem] border border-black/10 dark:border-white/10">
            <div className="grid h-full w-full grid-cols-8 grid-rows-8">
                {ranks.map((rank, rankIndex) =>
                  files.map((file, fileIndex) => {
                    const square = file + rank;
                    const piece = board[square] || null;
                    const isLight = (rankIndex + fileIndex) % 2 === 0;

                    return (
                      <Square
                        key={square}
                        square={square}
                        piece={piece}
                        isLight={isLight}
                        onDrop={handleDrop}
                        onSquareClick={onSquareClick}
                        isSelected={selectedSquare === square}
                        isPossibleMove={possibleMoves.includes(square)}
                        isLastMove={lastMoveSquares.includes(square)}
                        isCheck={checkSquare === square}
                        isCheckmate={checkmateSquare === square}
                        disabled={disabled}
                        rankLabel={fileIndex === 0 ? rank : undefined}
                        fileLabel={rankIndex === 7 ? file : undefined}
                      />
                    );
                  })
                )}
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
