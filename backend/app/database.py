"""
Database connection module.
Uses MongoDB (Motor) when available, falls back to in-memory storage for testing.
"""
from app.config import settings

# Try connecting to MongoDB
client = None
db = None
USE_MONGO = False

class InMemoryCollection:
    """Simple in-memory collection that mimics basic Motor/pymongo operations."""
    
    def __init__(self, name: str):
        self.name = name
        self._data = []
        self._id_counter = 0
    
    async def insert_one(self, doc: dict):
        from bson import ObjectId
        self._id_counter += 1
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = ObjectId()
        self._data.append(doc_copy)
        
        class Result:
            def __init__(self, id):
                self.inserted_id = id
        return Result(doc_copy["_id"])
    
    async def find_one(self, query: dict):
        from bson import ObjectId
        for doc in self._data:
            if self._matches(doc, query):
                return dict(doc)
        return None
    
    def find(self, query: dict = None, projection: dict = None):
        query = query or {}
        results = []
        for doc in self._data:
            if self._matches(doc, query):
                doc_copy = dict(doc)
                if projection:
                    for key, val in projection.items():
                        if val == 0 and key in doc_copy:
                            del doc_copy[key]
                results.append(doc_copy)
        
        class Cursor:
            def __init__(self, data):
                self._data = data
            async def to_list(self, length=100):
                return self._data[:length]
        
        return Cursor(results)
    
    def _matches(self, doc: dict, query: dict) -> bool:
        from bson import ObjectId
        for key, value in query.items():
            doc_val = doc.get(key)
            if isinstance(value, dict):
                # Handle MongoDB operators like $gte, $lte
                for op, op_val in value.items():
                    if op == "$gte" and doc_val is not None:
                        if doc_val < op_val:
                            return False
                    elif op == "$lte" and doc_val is not None:
                        if doc_val > op_val:
                            return False
                    else:
                        return False
            else:
                # Handle ObjectId comparison
                if key == "_id" and isinstance(value, ObjectId):
                    if str(doc_val) != str(value):
                        return False
                elif doc_val != value:
                    return False
        return True


class InMemoryDB:
    """Simple in-memory database."""
    def __init__(self):
        self._collections = {}
    
    def __getattr__(self, name):
        if name.startswith('_'):
            return super().__getattribute__(name)
        if name not in self._collections:
            self._collections[name] = InMemoryCollection(name)
        return self._collections[name]
    
    def __getitem__(self, name):
        return self.__getattr__(name)


# Initialize — will be replaced in lifespan if MongoDB is available
_in_memory_db = InMemoryDB()


def get_db():
    return db if db else _in_memory_db

def get_students_collection():
    return get_db().students

def get_attendance_collection():
    return get_db().attendance

def get_ble_events_collection():
    return get_db().ble_events
