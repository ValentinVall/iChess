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
  checkSquare?: string | null;
  checkmateSquare?: string | null;
  boardOrientation?: "white" | "black";
  disabled?: boolean;
}

const PIECE_IMAGES: Record<string, string> = {
  K: "/pieces/wK.svg", Q: "/pieces/wQ.svg", R: "/pieces/wR.svg", B: "/pieces/wB.svg", N: "/pieces/wN.svg", P: "/pieces/wP.svg",
  k: "/pieces/bK.svg", q: "/pieces/bQ.svg", r: "/pieces/bR.svg", b: "/pieces/bB.svg", n: "/pieces/bN.svg", p: "/pieces/bP.svg",
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
  isCheck?: boolean;
  isCheckmate?: boolean;
  disabled?: boolean;
}

function Square({ 
  square, 
  piece, 
  isLight, 
  onDrop,
  onSquareClick,
  isSelected = false,
  isPossibleMove = false,
  isCheck = false,
  isCheckmate = false,
  disabled = false
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
        ${isLight ? "bg-[#d9d7d7]" : "bg-[#ababab]"}
        ${isCheckmate ? "ring-inset ring-4 ring-red-500" : isCheck ? "ring-inset ring-4 ring-yellow-400" : ""}
        ${isSelected ? "ring-inset ring-4 ring-blue-400" : ""}
        ${isOver ? "ring-2 ring-white/40 ring-inset" : ""}
        ${isDragging ? "opacity-50" : ""}
        ${!disabled ? "cursor-pointer" : "cursor-not-allowed"}
        select-none transition-all
      `}
    >
      {/* Possible move indicator */}
      {isPossibleMove && !piece && (
        <div className="w-3 h-3 rounded-full bg-yellow-400/70 absolute" />
      )}
      
      {/* Capture indicator */}
      {isPossibleMove && piece && (
        <div className="w-2/3 h-2/3 rounded-full border-2 border-yellow-400/70 absolute" />
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
      <div className="w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
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
                  isCheck={checkSquare === square}
                  isCheckmate={checkmateSquare === square}
                  disabled={disabled}
                />
              );
            })
          )}
        </div>
      </div>
    </DndProvider>
  );
}
